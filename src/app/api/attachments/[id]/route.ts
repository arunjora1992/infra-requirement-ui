import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { uploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const att = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { requirement: true },
  });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canSee =
    user.role === "INFRA" ||
    user.role === "ADMIN" ||
    att.requirement.raiserId === user.id ||
    att.requirement.managerEmail.toLowerCase() === user.email.toLowerCase();
  if (!canSee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const buf = await fs.readFile(uploadPath(att.storedName));
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.originalName)}"`,
      "Content-Length": String(att.sizeBytes),
    },
  });
}
