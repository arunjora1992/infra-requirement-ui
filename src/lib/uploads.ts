import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/zip",
]);

export async function saveUpload(file: File, requirementId: string) {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (>${MAX_BYTES / 1024 / 1024}MB)`);
  }
  if (file.type && !ALLOWED.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || "";
  const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storedName = `${requirementId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBase}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storedName);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buf);
  return {
    storedName,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export function uploadPath(storedName: string) {
  const safe = path.basename(storedName);
  return path.join(UPLOAD_DIR, safe);
}
