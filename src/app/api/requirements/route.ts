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
  const team = searchParams.get("team") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const scope = searchParams.get("scope") ?? "auto"; // auto | mine | all

  const where: any = {};
  if (status) where.status = status as any;
  if (team) where.team = team;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { team: { contains: q, mode: "insensitive" } },
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
      team: data.team,
      environment: data.environment,
      priority: data.priority,
      vmCount: data.vmCount,
      vmCpu: data.vmCpu,
      vmMemoryGB: data.vmMemoryGB,
      vmStorageGB: data.vmStorageGB,
      osImage: data.osImage,
      podCount: data.podCount,
      podCpu: data.podCpu,
      podMemory: data.podMemory,
      k8sCluster: data.k8sCluster,
      k8sNamespace: data.k8sNamespace,
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
      events: {
        create: {
          type: "CREATED",
          actorEmail: user.email,
          message: "Requirement raised",
        },
      },
    },
  });

  // Fire and forget infra notification
  notifyInfraOfNew(created).catch((e) => console.error("notifyInfraOfNew", e));

  return NextResponse.json({ item: created }, { status: 201 });
}
