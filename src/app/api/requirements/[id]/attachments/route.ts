import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const r = await prisma.requirement.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit =
    user.role === "INFRA" || user.role === "ADMIN" || r.raiserId === user.id;
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kind = (form.get("kind") as string) || "BOQ";
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  try {
    const saved = await saveUpload(file, r.id);
    const att = await prisma.attachment.create({
      data: {
        requirementId: r.id,
        kind,
        originalName: saved.originalName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedById: user.id,
      },
    });
    await prisma.requirementEvent.create({
      data: {
        requirementId: r.id,
        type: "ATTACHMENT_ADDED",
        actorEmail: user.email,
        message: `${kind}: ${saved.originalName}`,
      },
    });
    return NextResponse.json({ attachment: att }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "upload failed" }, { status: 400 });
  }
}
