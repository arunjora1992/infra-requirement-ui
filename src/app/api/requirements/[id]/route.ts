import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { RequirementUpdateSchema } from "@/lib/validators";
import { addDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const item = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: {
      raiser: { select: { id: true, name: true, email: true } },
      vmSpecs: { orderBy: { createdAt: "asc" } },
      attachments: true,
      events: { orderBy: { createdAt: "desc" } },
      alertLogs: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canSee =
    user.role === "INFRA" ||
    user.role === "ADMIN" ||
    item.raiserId === user.id ||
    item.managerEmail.toLowerCase() === user.email.toLowerCase();
  if (!canSee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const existing = await prisma.requirement.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isInfra = user.role === "INFRA" || user.role === "ADMIN";
  const isRaiser = existing.raiserId === user.id;
  if (!isInfra && !isRaiser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = RequirementUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.status && !isInfra) {
    if (!(existing.status === "DRAFT" && data.status === "SUBMITTED")) {
      return NextResponse.json({ error: "Cannot change status" }, { status: 403 });
    }
  }

  let expiryDate = existing.expiryDate;
  if (data.tenureDays || data.startDate) {
    const start = data.startDate ?? existing.startDate ?? existing.raisedAt;
    const tenure = data.tenureDays ?? existing.tenureDays;
    expiryDate = addDays(start, tenure);
  }

  const updated = await prisma.requirement.update({
    where: { id: existing.id },
    data: {
      ...data,
      expiryDate,
      events: {
        create: {
          type: data.status ? "STATUS_CHANGED" : "UPDATED",
          actorEmail: user.email,
          message: data.status
            ? `Status: ${existing.status} → ${data.status}`
            : "Fields updated",
        },
      },
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.requirement.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
