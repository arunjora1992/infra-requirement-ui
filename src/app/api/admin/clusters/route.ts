import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  // Allow users to paste full API URLs — strip the trailing path
  u = u.replace(/\/ovirt-engine\/api\/?$/i, "");
  u = u.replace(/\/ovirt-engine\/?$/i, "");
  u = u.replace(/\/api\/?$/i, "");
  return u;
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  baseUrl: z
    .string()
    .url()
    .transform(normalizeBaseUrl),
  username: z.string().min(1).max(160),
  password: z.string().min(1).max(512),
  insecureTls: z.boolean().default(false),
});

export async function GET() {
  await requireRole(["ADMIN"]);
  const items = await prisma.ovirtCluster.findMany({ orderBy: { createdAt: "desc" } });
  // never return the encrypted password
  return NextResponse.json({
    items: items.map(({ passwordEnc, ...rest }) => ({ ...rest, hasPassword: !!passwordEnc })),
  });
}

export async function POST(req: Request) {
  await requireRole(["ADMIN"]);
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { password, ...rest } = parsed.data;
  const item = await prisma.ovirtCluster.create({
    data: { ...rest, passwordEnc: encrypt(password) },
  });
  const { passwordEnc, ...safe } = item;
  return NextResponse.json({ item: { ...safe, hasPassword: true } }, { status: 201 });
}
