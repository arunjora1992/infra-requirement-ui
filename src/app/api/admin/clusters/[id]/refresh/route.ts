import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { fetchCapacity } from "@/lib/ovirt";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireRole(["ADMIN"]);
  const c = await prisma.ovirtCluster.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const cap = await fetchCapacity(c);
    const updated = await prisma.ovirtCluster.update({
      where: { id: c.id },
      data: { ...cap, lastSyncedAt: new Date(), lastError: null },
    });
    const { passwordEnc, ...safe } = updated;
    return NextResponse.json({ item: { ...safe, hasPassword: !!passwordEnc } });
  } catch (e: any) {
    await prisma.ovirtCluster.update({
      where: { id: c.id },
      data: { lastError: String(e.message ?? e).slice(0, 500) },
    });
    return NextResponse.json(
      { error: String(e.message ?? e) },
      { status: 400 },
    );
  }
}
