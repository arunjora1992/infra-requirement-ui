import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ProvisioningUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireRole(["INFRA", "ADMIN"]);
  const r = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: { vmSpecs: true },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = ProvisioningUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const knownIds = new Set(r.vmSpecs.map((v) => v.id));
  const updates = data.vms.filter((v) => knownIds.has(v.id));

  const updated = await prisma.$transaction(async (tx) => {
    for (const v of updates) {
      await tx.vmSpec.update({
        where: { id: v.id },
        data: {
          hostname: v.hostname ?? null,
          ipAddress: v.ipAddress ?? null,
          notes: v.notes ?? null,
        },
      });
    }
    return tx.requirement.update({
      where: { id: r.id },
      data: {
        provisionedNamespace: data.provisionedNamespace ?? null,
        provisioningNotes: data.provisioningNotes ?? null,
        provisionedAt: new Date(),
        status: r.status === "APPROVED" || r.status === "IN_REVIEW" ? "PROVISIONED" : r.status,
        events: {
          create: {
            type: "PROVISIONED",
            actorEmail: user.email,
            message: `Provisioning details updated (${updates.length} VM(s))`,
          },
        },
      },
      include: { vmSpecs: true },
    });
  });

  return NextResponse.json({ item: updated });
}
