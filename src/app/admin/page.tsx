import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const u = await currentUser();
  if (!u) redirect("/login?callbackUrl=/admin");
  if (u.role !== "ADMIN") return <div className="card p-8">Forbidden — admin only.</div>;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted text-sm">Manage user roles and teams.</p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
