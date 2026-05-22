import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireRole(["INFRA", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const onlyNew = (searchParams.get("new") ?? "false").toLowerCase() === "true";
  const status = searchParams.get("status") ?? undefined;

  const where: any = {};
  if (onlyNew) where.status = "SUBMITTED";
  if (status) where.status = status;

  const items = await prisma.requirement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { raiser: true, _count: { select: { attachments: true } } },
  });

  const rows = items.map((r) => ({
    id: r.id,
    title: r.title,
    team: r.team,
    environment: r.environment,
    priority: r.priority,
    status: r.status,
    vmCount: r.vmCount,
    vmCpu: r.vmCpu,
    vmMemoryGB: r.vmMemoryGB,
    vmStorageGB: r.vmStorageGB,
    osImage: r.osImage,
    podCount: r.podCount,
    podCpu: r.podCpu,
    podMemory: r.podMemory,
    k8sCluster: r.k8sCluster,
    k8sNamespace: r.k8sNamespace,
    needsLoadBalancer: r.needsLoadBalancer,
    needsPublicIp: r.needsPublicIp,
    needsDatabase: r.needsDatabase,
    databaseEngine: r.databaseEngine,
    storageGB: r.storageGB,
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
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const csv = toCsv(rows);
  const filename = `requirements-${onlyNew ? "new-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
