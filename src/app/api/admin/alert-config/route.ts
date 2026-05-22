import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { reloadScheduler } from "@/lib/scheduler";
import cron from "node-cron";

export const dynamic = "force-dynamic";

const Schema = z.object({
  enabled: z.boolean().optional(),
  cronExpression: z
    .string()
    .min(5)
    .max(120)
    .refine((s) => cron.validate(s), "Invalid cron expression")
    .optional(),
  preExpiryDays: z.coerce.number().int().min(1).max(60).optional(),
  postExpiryReminderDays: z.coerce.number().int().min(0).max(30).optional(),
  shutdownAfterDays: z.coerce.number().int().min(1).max(60).optional(),
  ccEmails: z.array(z.string().email()).optional(),
  notifyInfra: z.boolean().optional(),
  notifyManager: z.boolean().optional(),
  notifyRaiser: z.boolean().optional(),
});

export async function GET() {
  await requireRole(["ADMIN"]);
  const cfg =
    (await prisma.alertConfig.findUnique({ where: { id: "default" } })) ||
    (await prisma.alertConfig.create({ data: { id: "default" } }));
  return NextResponse.json({ config: cfg });
}

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cfg = await prisma.alertConfig.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  reloadScheduler().catch((e) => console.error("reloadScheduler failed", e));
  return NextResponse.json({ config: cfg });
}
