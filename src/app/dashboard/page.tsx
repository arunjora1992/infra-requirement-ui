import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Download, AlertTriangle, Clock, CheckCircle2, Server, FileText, Sigma } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/utils";
import { FilterBar } from "./FilterBar";

export const dynamic = "force-dynamic";

type Props = { searchParams: { status?: string; q?: string; scope?: string } };

export default async function Dashboard({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/dashboard");

  const canSeeAll = user.role === "INFRA" || user.role === "ADMIN";
  const scope = searchParams.scope ?? (canSeeAll ? "all" : "mine");

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.q) {
    where.OR = [
      { title: { contains: searchParams.q, mode: "insensitive" } },
      { projectName: { contains: searchParams.q, mode: "insensitive" } },
      { managerName: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }
  if (scope === "mine") {
    where.AND = [
      ...(where.AND ?? []),
      { OR: [{ raiserId: user.id }, { managerEmail: user.email }] },
    ];
  }

  // Grand totals consider only active (not REJECTED / SHUTDOWN) requirements
  const liveWhere = canSeeAll
    ? { status: { notIn: ["REJECTED", "SHUTDOWN"] as any[] } }
    : { ...where, status: { notIn: ["REJECTED", "SHUTDOWN"] as any[] } };

  const [items, counts, vmAgg, nsAgg, sharedAgg, vmCountAgg] = await Promise.all([
    prisma.requirement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { raiser: { select: { name: true, email: true } } },
      take: 200,
    }),
    prisma.requirement.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.vmSpec.aggregate({
      _sum: { cpu: true, memoryGB: true, storageGB: true },
      where: { requirement: liveWhere as any },
    }),
    prisma.requirement.aggregate({
      _sum: { nsQuotaCpu: true, nsQuotaMemoryGB: true, nsQuotaStorageGB: true },
      where: { ...(liveWhere as any), needsK8s: true },
    }),
    prisma.requirement.aggregate({
      _sum: { storageGB: true },
      where: liveWhere as any,
    }),
    prisma.requirement.aggregate({
      _sum: { vmCount: true },
      where: liveWhere as any,
    }),
  ]);

  const grand = {
    vms: vmCountAgg._sum.vmCount ?? 0,
    cpu: (vmAgg._sum.cpu ?? 0) + (nsAgg._sum.nsQuotaCpu ?? 0),
    mem: (vmAgg._sum.memoryGB ?? 0) + (nsAgg._sum.nsQuotaMemoryGB ?? 0),
    storage:
      (vmAgg._sum.storageGB ?? 0) +
      (nsAgg._sum.nsQuotaStorageGB ?? 0) +
      (sharedAgg._sum.storageGB ?? 0),
    vmCpu: vmAgg._sum.cpu ?? 0,
    vmMem: vmAgg._sum.memoryGB ?? 0,
    vmDisk: vmAgg._sum.storageGB ?? 0,
    nsCpu: nsAgg._sum.nsQuotaCpu ?? 0,
    nsMem: nsAgg._sum.nsQuotaMemoryGB ?? 0,
    nsStore: nsAgg._sum.nsQuotaStorageGB ?? 0,
    shared: sharedAgg._sum.storageGB ?? 0,
  };

  const statTotals = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((a, c) => a + c._count._all, 0);
  const expiring = items.filter(
    (r) =>
      r.expiryDate &&
      new Date(r.expiryDate).getTime() - Date.now() < 7 * 86400_000 &&
      r.status !== "SHUTDOWN" &&
      r.status !== "REJECTED",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted text-sm">
            {canSeeAll
              ? "All projects' infrastructure requirements."
              : "Requirements you raised or manage."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canSeeAll && (
            <>
              <a className="btn" href="/api/requirements/export">
                <Download size={14} /> CSV (all)
              </a>
              <a className="btn" href="/api/requirements/export?new=true">
                <Download size={14} /> CSV (new)
              </a>
              <a className="btn" href="/api/requirements/export?format=pdf">
                <FileText size={14} /> PDF (all)
              </a>
              <a className="btn" href="/api/requirements/export?format=pdf&new=true">
                <FileText size={14} /> PDF (new)
              </a>
            </>
          )}
          <Link href="/requirements/new" className="btn btn-primary">
            <Plus size={14} /> New requirement
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Server size={16} />} label="Total" value={total} />
        <Stat
          icon={<Clock size={16} />}
          label="Submitted"
          value={statTotals.SUBMITTED ?? 0}
        />
        <Stat
          icon={<CheckCircle2 size={16} />}
          label="Provisioned"
          value={statTotals.PROVISIONED ?? 0}
        />
        <Stat
          icon={<AlertTriangle size={16} />}
          label="Expiring ≤7d"
          value={expiring}
          tone="warning"
        />
      </div>

      <div className="card p-5 border-accent/40 shadow-glow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sigma size={16} className="text-accent" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Overall infrastructure committed (active requirements)
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Totl label="Total VMs" value={grand.vms} />
          <Totl
            label="Total vCPU"
            value={`${grand.cpu} cores`}
            hint={`${grand.vmCpu} VM + ${grand.nsCpu} k8s`}
          />
          <Totl
            label="Total memory"
            value={`${grand.mem} GB`}
            hint={`${grand.vmMem} VM + ${grand.nsMem} k8s`}
          />
          <Totl
            label="Total storage"
            value={`${grand.storage} GB`}
            hint={`${grand.vmDisk} VM + ${grand.nsStore} k8s + ${grand.shared} shared`}
          />
        </div>
      </div>

      <FilterBar canSeeAll={canSeeAll} />

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Env</th>
              <th>VMs</th>
              <th>K8s</th>
              <th>Manager</th>
              <th>Raised</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted py-10">
                  No requirements yet. Raise one to get started.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="cursor-pointer">
                <td>
                  <Link href={`/requirements/${r.id}`} className="hover:text-accent font-medium">
                    {r.title}
                  </Link>
                  <div className="text-xs text-muted">{r.raiser.email}</div>
                </td>
                <td>{r.projectName}</td>
                <td><span className="chip">{r.environment}</span></td>
                <td>{r.vmCount}</td>
                <td>{r.needsK8s ? "yes" : "—"}</td>
                <td>
                  <div>{r.managerName}</div>
                  <div className="text-xs text-muted">{r.managerEmail}</div>
                </td>
                <td className="whitespace-nowrap">{fmtDate(r.raisedAt)}</td>
                <td className="whitespace-nowrap">{fmtDate(r.expiryDate)}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Totl({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
        <div className={tone === "warning" ? "text-warning" : "text-accent"}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
