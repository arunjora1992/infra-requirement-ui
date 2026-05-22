import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { toCsv } from "@/lib/csv";
import { buildRequirementsPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireRole(["INFRA", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const onlyNew = (searchParams.get("new") ?? "false").toLowerCase() === "true";
  const status = searchParams.get("status") ?? undefined;
  const format = (searchParams.get("format") ?? "csv").toLowerCase();

  const where: any = {};
  if (onlyNew) where.status = "SUBMITTED";
  if (status) where.status = status;

  const items = await prisma.requirement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      raiser: true,
      vmSpecs: { orderBy: { createdAt: "asc" } },
      _count: { select: { attachments: true } },
    },
  });

  const datePart = new Date().toISOString().slice(0, 10);
  const baseName = `requirements-${onlyNew ? "new-" : ""}${datePart}`;

  if (format === "pdf") {
    const pdf = await buildRequirementsPdf(items);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  type Row = Record<string, string | number | boolean | Date | null | undefined>;
  const rows: Row[] = items.flatMap((r): Row[] => {
    // One row per VM (so per-VM details are visible in CSV).
    // For requirements with no VMs, still emit a single row.
    const common: Row = {
      id: r.id,
      title: r.title,
      projectName: r.projectName,
      environment: r.environment,
      priority: r.priority,
      status: r.status,
      vmCount: r.vmCount,
      needsK8s: r.needsK8s,
      k8sNamespace: r.k8sNamespace,
      nsQuotaCpu: r.nsQuotaCpu,
      nsQuotaMemoryGB: r.nsQuotaMemoryGB,
      nsQuotaStorageGB: r.nsQuotaStorageGB,
      utilityServices: (r.utilityServices ?? []).join("|"),
      needsLoadBalancer: r.needsLoadBalancer,
      needsPublicIp: r.needsPublicIp,
      needsDatabase: r.needsDatabase,
      databaseEngine: r.databaseEngine,
      sharedStorageGB: r.storageGB,
      tenureDays: r.tenureDays,
      raisedAt: r.raisedAt,
      startDate: r.startDate,
      expiryDate: r.expiryDate,
      costCenter: r.costCenter,
      justification: r.justification,
      managerName: r.managerName,
      managerEmail: r.managerEmail,
      raiserName: r.raiser.name ?? "",
      raiserEmail: r.raiser.email,
      attachmentCount: r._count.attachments,
      provisionedAt: r.provisionedAt,
      provisionedNamespace: r.provisionedNamespace,
      provisioningNotes: r.provisioningNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
    if (r.vmSpecs.length === 0) {
      return [
        {
          ...common,
          vmIndex: null,
          vmName: null,
          vmPurpose: null,
          vmCpu: null,
          vmMemoryGB: null,
          vmStorageGB: null,
          vmOs: null,
          vmHostname: null,
          vmIp: null,
          vmNotes: null,
        },
      ];
    }
    return r.vmSpecs.map((v, idx) => ({
      ...common,
      vmIndex: idx + 1,
      vmName: v.name,
      vmPurpose: v.purpose,
      vmCpu: v.cpu,
      vmMemoryGB: v.memoryGB,
      vmStorageGB: v.storageGB,
      vmOs: v.osImage,
      vmHostname: v.hostname,
      vmIp: v.ipAddress,
      vmNotes: v.notes,
    }));
  });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  });
}
