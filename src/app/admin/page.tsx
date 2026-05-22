import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminTabs } from "./AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const u = await currentUser();
  if (!u) redirect("/login?callbackUrl=/admin");
  if (u.role !== "ADMIN") return <div className="card p-8">Forbidden — admin only.</div>;

  const [users, modules, managers, osVersions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.module.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.managerOption.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.osVersion.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted text-sm">
          Manage users, modules, managers and OS versions used across requirements.
        </p>
      </div>
      <AdminTabs users={users} modules={modules} managers={managers} osVersions={osVersions} />
    </div>
  );
}
