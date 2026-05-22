import { prisma } from "./db";
import { sendMail } from "./mailer";
import {
  preExpiryEmail,
  postExpiryEmail,
  shutdownEmail,
  newRequirementEmail,
} from "./email-templates";
import type { Requirement } from "@prisma/client";

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function infraTeamEmails(): Promise<string[]> {
  const infraUsers = await prisma.user.findMany({
    where: { role: { in: ["INFRA", "ADMIN"] } },
    select: { email: true },
  });
  return infraUsers.map((u) => u.email);
}

export async function getAlertConfig() {
  let cfg = await prisma.alertConfig.findUnique({ where: { id: "default" } });
  if (!cfg) {
    cfg = await prisma.alertConfig.create({ data: { id: "default" } });
  }
  return cfg;
}

function recipientsFor(
  r: Requirement,
  raiserEmail: string,
  infraEmails: string[],
  cfg: { notifyRaiser: boolean; notifyManager: boolean; notifyInfra: boolean; ccEmails: string[] },
) {
  const set = new Set<string>();
  if (cfg.notifyRaiser) set.add(raiserEmail);
  if (cfg.notifyManager && r.managerEmail) set.add(r.managerEmail);
  if (cfg.notifyInfra) for (const e of infraEmails) set.add(e);
  for (const e of cfg.ccEmails) set.add(e);
  return Array.from(set);
}

export async function runAlertSweep(now: Date = new Date()) {
  const cfg = await getAlertConfig();
  if (!cfg.enabled) {
    console.log("[alerts] disabled in AlertConfig");
    return { preWarning: 0, postDaily: 0, shutdown: 0, skipped: 0 };
  }

  const today = startOfDay(now);
  const horizonStart = new Date(today);
  horizonStart.setDate(horizonStart.getDate() - (cfg.shutdownAfterDays + 3));
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + (cfg.preExpiryDays + 3));

  const requirements = await prisma.requirement.findMany({
    where: {
      expiryDate: { gte: horizonStart, lte: horizonEnd },
      status: { notIn: ["REJECTED", "SHUTDOWN"] },
    },
    include: { raiser: true },
  });

  const infraEmails = await infraTeamEmails();
  const summary = { preWarning: 0, postDaily: 0, shutdown: 0, skipped: 0 };

  for (const r of requirements) {
    const delta = daysBetween(r.expiryDate, today); // >0 future, <0 past
    const recipients = recipientsFor(r, r.raiser.email, infraEmails, cfg);
    if (recipients.length === 0) continue;

    // pre-expiry warning at T-N
    if (delta === cfg.preExpiryDays) {
      const already = await prisma.alertLog.findUnique({
        where: {
          requirementId_kind_dayOffset: {
            requirementId: r.id,
            kind: "PRE_EXPIRY_WARNING",
            dayOffset: cfg.preExpiryDays,
          },
        },
      });
      if (!already) {
        const tpl = preExpiryEmail(r, cfg.preExpiryDays);
        await sendMail({ to: recipients, subject: tpl.subject, html: tpl.html });
        await prisma.alertLog.create({
          data: {
            requirementId: r.id,
            kind: "PRE_EXPIRY_WARNING",
            dayOffset: cfg.preExpiryDays,
            recipients: recipients.join(","),
            subject: tpl.subject,
          },
        });
        summary.preWarning++;
      } else summary.skipped++;
    }

    // post-expiry daily reminders 1..N
    if (delta <= 0 && delta >= -cfg.postExpiryReminderDays) {
      const daysSince = -delta;
      if (daysSince >= 1) {
        const already = await prisma.alertLog.findUnique({
          where: {
            requirementId_kind_dayOffset: {
              requirementId: r.id,
              kind: "POST_EXPIRY_DAILY",
              dayOffset: daysSince,
            },
          },
        });
        if (!already) {
          const tpl = postExpiryEmail(r, daysSince);
          await sendMail({ to: recipients, subject: tpl.subject, html: tpl.html });
          await prisma.alertLog.create({
            data: {
              requirementId: r.id,
              kind: "POST_EXPIRY_DAILY",
              dayOffset: daysSince,
              recipients: recipients.join(","),
              subject: tpl.subject,
            },
          });
          summary.postDaily++;
        } else summary.skipped++;
      }
    }

    // shutdown at T+shutdownAfterDays
    if (delta === -cfg.shutdownAfterDays) {
      const already = await prisma.alertLog.findUnique({
        where: {
          requirementId_kind_dayOffset: {
            requirementId: r.id,
            kind: "SHUTDOWN_NOTICE",
            dayOffset: cfg.shutdownAfterDays,
          },
        },
      });
      if (!already) {
        const tpl = shutdownEmail(r);
        await sendMail({ to: recipients, subject: tpl.subject, html: tpl.html });
        await prisma.alertLog.create({
          data: {
            requirementId: r.id,
            kind: "SHUTDOWN_NOTICE",
            dayOffset: cfg.shutdownAfterDays,
            recipients: recipients.join(","),
            subject: tpl.subject,
          },
        });
        await prisma.requirement.update({
          where: { id: r.id },
          data: { status: "SHUTDOWN" },
        });
        await prisma.requirementEvent.create({
          data: {
            requirementId: r.id,
            type: "STATUS_CHANGED",
            message: `Auto-marked SHUTDOWN after ${cfg.shutdownAfterDays} days past expiry`,
          },
        });
        summary.shutdown++;
      } else summary.skipped++;
    } else if (delta < 0 && r.status !== "EXPIRED" && r.status !== "SHUTDOWN") {
      await prisma.requirement.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
    }
  }
  return summary;
}

export async function notifyInfraOfNew(r: Requirement) {
  const infraEmails = await infraTeamEmails();
  if (infraEmails.length === 0) return;
  const tpl = newRequirementEmail(r);
  await sendMail({ to: infraEmails, subject: tpl.subject, html: tpl.html });
  await prisma.alertLog.create({
    data: {
      requirementId: r.id,
      kind: "NEW_REQUIREMENT",
      dayOffset: 0,
      recipients: infraEmails.join(","),
      subject: tpl.subject,
    },
  });
}
