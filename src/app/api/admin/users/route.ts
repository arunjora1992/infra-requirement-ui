import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["ADMIN"]);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ users });
}

const PatchSchema = z.object({
  id: z.string(),
  role: z.enum(["USER", "MANAGER", "INFRA", "ADMIN"]).optional(),
  team: z.string().max(120).optional(),
});

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const u = await prisma.user.update({
    where: { id: parsed.data.id },
    data: { role: parsed.data.role, team: parsed.data.team },
  });
  return NextResponse.json({ user: u });
}
