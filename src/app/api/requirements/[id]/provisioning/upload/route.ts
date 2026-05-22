import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// CSV columns expected: name, hostname, ipAddress, notes
// "name" must match a VmSpec.name on this requirement.
// Header row required.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
    out.push(row);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireRole(["INFRA", "ADMIN"]);
  const r = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: { vmSpecs: true },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const byName = new Map(r.vmSpecs.map((v) => [v.name.toLowerCase(), v]));
  const matched: string[] = [];
  const skipped: string[] = [];
  const created: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const name = (row["name"] || row["vm name"] || row["vmname"] || "").trim();
      if (!name) {
        skipped.push(JSON.stringify(row));
        continue;
      }
      const vm = byName.get(name.toLowerCase());
      const hostname = row["hostname"] || row["host"] || null;
      const ipAddress = row["ipaddress"] || row["ip"] || row["ip address"] || null;
      const notes = row["notes"] || row["note"] || null;
      if (vm) {
        await tx.vmSpec.update({
          where: { id: vm.id },
          data: {
            hostname: hostname || null,
            ipAddress: ipAddress || null,
            notes: notes || null,
          },
        });
        matched.push(name);
      } else {
        // Allow adding new rows from the sheet (eg. infra split a request VM into many)
        // Only if cpu/memory/storage are provided; otherwise skip.
        const cpu = Number(row["cpu"] || row["vcpu"] || 0);
        const memoryGB = Number(row["memorygb"] || row["ram"] || row["memory"] || 0);
        const storageGB = Number(row["storagegb"] || row["disk"] || row["storage"] || 0);
        if (cpu > 0 && memoryGB > 0 && storageGB > 0) {
          await tx.vmSpec.create({
            data: {
              requirementId: r.id,
              name,
              purpose: row["purpose"] || null,
              cpu,
              memoryGB,
              storageGB,
              osImage: row["os"] || row["osimage"] || null,
              hostname: hostname || null,
              ipAddress: ipAddress || null,
              notes: notes || null,
            },
          });
          created.push(name);
        } else {
          skipped.push(name);
        }
      }
    }

    await tx.requirement.update({
      where: { id: r.id },
      data: {
        provisionedAt: new Date(),
        status: r.status === "APPROVED" || r.status === "IN_REVIEW" ? "PROVISIONED" : r.status,
        vmCount: r.vmCount + created.length,
        events: {
          create: {
            type: "PROVISIONED",
            actorEmail: user.email,
            message: `Bulk upload: ${matched.length} updated, ${created.length} added, ${skipped.length} skipped`,
          },
        },
      },
    });
  });

  return NextResponse.json({
    matched,
    created,
    skipped,
    summary: {
      updated: matched.length,
      created: created.length,
      skipped: skipped.length,
    },
  });
}
