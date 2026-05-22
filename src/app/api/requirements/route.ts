import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { RequirementCreateSchema } from "@/lib/validators";
import { addDays } from "@/lib/utils";
import { notifyInfraOfNew } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const projectName = searchParams.get("projectName") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const scope = searchParams.get("scope") ?? "auto"; // auto | mine | all

  const where: any = {};
  if (status) where.status = status as any;
  if (projectName) where.projectName = projectName;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { projectName: { contains: q, mode: "insensitive" } },
      { managerName: { contains: q, mode: "insensitive" } },
    ];
  }

  const canSeeAll = user.role === "INFRA" || user.role === "ADMIN";
  if (scope === "mine" || (!canSeeAll && scope !== "all")) {
    where.OR = [
      ...(where.OR ?? []),
      { raiserId: user.id },
      { managerEmail: user.email },
    ];
  }

  const items = await prisma.requirement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      raiser: { select: { id: true, name: true, email: true } },
      vmSpecs: true,
      _count: { select: { attachments: true } },
    },
    take: 500,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const parsed = RequirementCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const startDate = data.startDate ?? new Date();
  const expiryDate = addDays(startDate, data.tenureDays);

  const created = await prisma.requirement.create({
    data: {
      title: data.title,
      description: data.description,
      projectName: data.projectName,
      environment: data.environment,
      priority: data.priority,
      vmCount: data.vmSpecs.length,
      needsK8s: data.needsK8s,
      k8sNamespace: data.k8sNamespace,
      nsQuotaCpu: data.nsQuotaCpu,
      nsQuotaMemoryGB: data.nsQuotaMemoryGB,
      nsQuotaStorageGB: data.nsQuotaStorageGB,
      utilityServices: data.utilityServices,
      needsLoadBalancer: data.needsLoadBalancer,
      needsPublicIp: data.needsPublicIp,
      needsDatabase: data.needsDatabase,
      databaseEngine: data.databaseEngine,
      storageGB: data.storageGB,
      tenureDays: data.tenureDays,
      startDate,
      expiryDate,
      costCenter: data.costCenter,
      justification: data.justification,
      managerEmail: data.managerEmail,
      managerName: data.managerName,
      raiserId: user.id,
      status: "SUBMITTED",
      vmSpecs: {
        create: data.vmSpecs.map((v) => ({
          name: v.name,
          purpose: v.purpose,
          cpu: v.cpu,
          memoryGB: v.memoryGB,
          storageGB: v.storageGB,
          osImage: v.osImage,
        })),
      },
      events: {
        create: {
          type: "CREATED",
          actorEmail: user.email,
          message: "Requirement raised",
        },
      },
    },
    include: { vmSpecs: true },
  });

  notifyInfraOfNew(created).catch((e) => console.error("notifyInfraOfNew", e));

  return NextResponse.json({ item: created }, { status: 201 });
}
