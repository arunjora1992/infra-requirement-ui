import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireUser();
  const [modules, managers, osVersions] = await Promise.all([
    prisma.module.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.managerOption.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.osVersion.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ modules, managers, osVersions });
}
