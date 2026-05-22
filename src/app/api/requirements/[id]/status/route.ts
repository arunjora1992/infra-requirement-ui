import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum([
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "APPROVED",
    "REJECTED",
    "PROVISIONED",
    "EXPIRED",
    "SHUTDOWN",
  ]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireRole(["INFRA", "ADMIN"]);
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const r = await prisma.requirement.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.requirement.update({
    where: { id: r.id },
    data: {
      status: parsed.data.status,
      events: {
        create: {
          type: "STATUS_CHANGED",
          actorEmail: user.email,
          message: `${r.status} → ${parsed.data.status}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
        },
      },
    },
  });
  return NextResponse.json({ item: updated });
}
