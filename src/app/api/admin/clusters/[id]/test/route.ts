import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { testConnection } from "@/lib/ovirt";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireRole(["ADMIN"]);
  const c = await prisma.ovirtCluster.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const r = await testConnection(c);
    await prisma.ovirtCluster.update({
      where: { id: c.id },
      data: { lastError: null },
    });
    return NextResponse.json(r);
  } catch (e: any) {
    await prisma.ovirtCluster.update({
      where: { id: c.id },
      data: { lastError: String(e.message ?? e).slice(0, 500) },
    });
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 400 });
  }
}
