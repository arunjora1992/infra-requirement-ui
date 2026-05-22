import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  baseUrl: z.string().url().optional(),
  username: z.string().min(1).max(160).optional(),
  password: z.string().min(1).max(512).optional(),
  insecureTls: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { password, ...rest } = parsed.data;
  const data: any = { ...rest };
  if (password) data.passwordEnc = encrypt(password);
  const item = await prisma.ovirtCluster.update({ where: { id: params.id }, data });
  const { passwordEnc, ...safe } = item;
  return NextResponse.json({ item: { ...safe, hasPassword: !!passwordEnc } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await requireRole(["ADMIN"]);
  await prisma.ovirtCluster.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
