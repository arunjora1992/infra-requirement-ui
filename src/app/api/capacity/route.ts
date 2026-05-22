import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  const isPrivileged = user.role === "INFRA" || user.role === "ADMIN";

  const clusters = await prisma.ovirtCluster.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      cpuCoresTotal: true,
      cpuCoresUsed: true,
      memoryGBTotal: true,
      memoryGBAvailable: true,
      storageGBTotal: true,
      storageGBAvailable: true,
      lastSyncedAt: true,
    },
  });

  const totals = clusters.reduce(
    (a, c) => ({
      cpuCoresTotal: a.cpuCoresTotal + (c.cpuCoresTotal ?? 0),
      cpuCoresAvailable:
        a.cpuCoresAvailable + Math.max(0, (c.cpuCoresTotal ?? 0) - (c.cpuCoresUsed ?? 0)),
      memoryGBTotal: a.memoryGBTotal + (c.memoryGBTotal ?? 0),
      memoryGBAvailable: a.memoryGBAvailable + (c.memoryGBAvailable ?? 0),
      storageGBTotal: a.storageGBTotal + (c.storageGBTotal ?? 0),
      storageGBAvailable: a.storageGBAvailable + (c.storageGBAvailable ?? 0),
    }),
    {
      cpuCoresTotal: 0,
      cpuCoresAvailable: 0,
      memoryGBTotal: 0,
      memoryGBAvailable: 0,
      storageGBTotal: 0,
      storageGBAvailable: 0,
    },
  );

  const hasData = clusters.some((c) => c.lastSyncedAt);

  if (!isPrivileged) {
    // Regular users get only the over-capacity thresholds, not the raw numbers.
    // We need *something* for the UI to compute "over" — return only the
    // availability ceilings, no totals/used breakdowns, no cluster names.
    return NextResponse.json({
      hasData,
      isPrivileged: false,
      // exposed: availability ceilings (used as boolean threshold)
      availability: {
        cpu: totals.cpuCoresAvailable,
        memory: totals.memoryGBAvailable,
        storage: totals.storageGBAvailable,
      },
    });
  }

  return NextResponse.json({
    hasData,
    isPrivileged: true,
    clusters,
    totals,
  });
}
