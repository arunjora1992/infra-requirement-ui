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

function recipientsFor(r: Requirement, raiserEmail: string, infraEmails: string[]) {
  const set = new Set<string>();
  set.add(raiserEmail);
  if (r.managerEmail) set.add(r.managerEmail);
  for (const e of infraEmails) set.add(e);
  return Array.from(set);
}

/**
 * Daily sweep:
 * - 7 days before expiry: send pre-expiry warning (once)
 * - 0..7 days after expiry: send daily post-expiry mail (once per day)
 * - 7 days after expiry: also send shutdown notice (once) and flip status to SHUTDOWN
 */
export async function runAlertSweep(now: Date = new Date()) {
  const today = startOfDay(now);
  const horizonStart = new Date(today);
  horizonStart.setDate(horizonStart.getDate() - 10);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + 10);

  const requirements = await prisma.requirement.findMany({
    where: {
      expiryDate: { gte: horizonStart, lte: horizonEnd },
      status: { notIn: ["REJECTED", "SHUTDOWN"] },
    },
    include: { raiser: true },
  });

  const infraEmails = await infraTeamEmails();
  const summary = {
    preWarning: 0,
    postDaily: 0,
    shutdown: 0,
    skipped: 0,
  };

  for (const r of requirements) {
    const delta = daysBetween(r.expiryDate, today); // >0 = future, <0 = past
    const raiserEmail = r.raiser.email;
    const recipients = recipientsFor(r, raiserEmail, infraEmails);

    // 7-day pre-warning
    if (delta === 7) {
      const already = await prisma.alertLog.findUnique({
        where: {
          requirementId_kind_dayOffset: {
            requirementId: r.id,
            kind: "PRE_EXPIRY_WARNING",
            dayOffset: 7,
          },
        },
      });
      if (!already) {
        const tpl = preExpiryEmail(r, 7);
        await sendMail({ to: recipients, subject: tpl.subject, html: tpl.html });
        await prisma.alertLog.create({
          data: {
            requirementId: r.id,
            kind: "PRE_EXPIRY_WARNING",
            dayOffset: 7,
            recipients: recipients.join(","),
            subject: tpl.subject,
          },
        });
        summary.preWarning++;
      } else summary.skipped++;
    }

    // post-expiry daily mails for 1..7 days past expiry
    if (delta <= 0 && delta >= -7) {
      const daysSince = -delta; // 0..7
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

      // Day 7 shutdown notice
      if (daysSince === 7) {
        const already = await prisma.alertLog.findUnique({
          where: {
            requirementId_kind_dayOffset: {
              requirementId: r.id,
              kind: "SHUTDOWN_NOTICE",
              dayOffset: 7,
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
              dayOffset: 7,
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
              message: "Auto-marked SHUTDOWN after 7 days past expiry",
            },
          });
          summary.shutdown++;
        } else summary.skipped++;
      } else if (daysSince > 0 && r.status !== "EXPIRED" && r.status !== "SHUTDOWN") {
        await prisma.requirement.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
      }
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
