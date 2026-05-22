import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminTabs } from "./AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const u = await currentUser();
  if (!u) redirect("/login?callbackUrl=/admin");
  if (u.role !== "ADMIN") return <div className="card p-8">Forbidden — admin only.</div>;

  const [users, modules, managers, osVersions, alertConfig, clustersRaw] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.module.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.managerOption.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.osVersion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.alertConfig
      .findUnique({ where: { id: "default" } })
      .then((c) =>
        c ?? prisma.alertConfig.create({ data: { id: "default" } }),
      ),
    prisma.ovirtCluster.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const clusters = clustersRaw.map(({ passwordEnc, ...rest }) => ({
    ...rest,
    hasPassword: !!passwordEnc,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted text-sm">
          Manage users, lookup lists, alert behavior, and oVirt/RHEV clusters.
        </p>
      </div>
      <AdminTabs
        users={users}
        modules={modules}
        managers={managers}
        osVersions={osVersions}
        alertConfig={alertConfig}
        clusters={clusters as any}
      />
    </div>
  );
}
