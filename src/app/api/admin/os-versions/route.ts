import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({ name: z.string().min(1).max(120) });
const PatchSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  await requireRole(["ADMIN"]);
  const items = await prisma.osVersion.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const item = await prisma.osVersion.create({ data: parsed.data });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.code === "P2002" ? "Already exists" : e.message },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const item = await prisma.osVersion.update({ where: { id }, data: rest });
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  await requireRole(["ADMIN"]);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.osVersion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
