import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/utils";
import { Download, Paperclip, Sigma } from "lucide-react";
import { StatusActions } from "./StatusActions";
import { ProvisioningPanel } from "./ProvisioningPanel";

export const dynamic = "force-dynamic";

export default async function RequirementDetail({
  params,
}: {
  params: { id: string };
}) {
  const user = await currentUser();
  if (!user) redirect(`/login?callbackUrl=/requirements/${params.id}`);

  const r = await prisma.requirement.findUnique({
    where: { id: params.id },
    include: {
      raiser: { select: { name: true, email: true } },
      vmSpecs: { orderBy: { createdAt: "asc" } },
      attachments: true,
      events: { orderBy: { createdAt: "desc" } },
      alertLogs: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!r) notFound();

  const canSee =
    user.role === "INFRA" ||
    user.role === "ADMIN" ||
    r.raiserId === user.id ||
    r.managerEmail.toLowerCase() === user.email.toLowerCase();
  if (!canSee) return <div className="card p-8">Forbidden</div>;

  const isInfra = user.role === "INFRA" || user.role === "ADMIN";

  const sumVm = r.vmSpecs.reduce(
    (a, v) => ({
      cpu: a.cpu + v.cpu,
      mem: a.mem + v.memoryGB,
      disk: a.disk + v.storageGB,
    }),
    { cpu: 0, mem: 0, disk: 0 },
  );
  const k8sCpu = r.needsK8s ? r.nsQuotaCpu ?? 0 : 0;
  const k8sMem = r.needsK8s ? r.nsQuotaMemoryGB ?? 0 : 0;
  const k8sStore = r.needsK8s ? r.nsQuotaStorageGB ?? 0 : 0;
  const shared = r.storageGB ?? 0;
  const totals = {
    cpu: sumVm.cpu + k8sCpu,
    mem: sumVm.mem + k8sMem,
    storage: sumVm.disk + k8sStore + shared,
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              {r.projectName}
              {r.moduleName ? ` · ${r.moduleName}` : ""} · {r.environment} · {r.priority}
            </div>
            <h1 className="text-2xl font-semibold mt-1">{r.title}</h1>
            <div className="text-sm text-muted mt-1">
              Raised by {r.raiser.name ?? r.raiser.email} on {fmtDate(r.raisedAt)}
            </div>
          </div>
          <StatusBadge status={r.status} />
        </div>
        {r.description && (
          <p className="mt-4 text-sm text-fg/90 whitespace-pre-wrap">{r.description}</p>
        )}
        {r.justification && (
          <div className="mt-4">
            <div className="label">Justification</div>
            <p className="text-sm whitespace-pre-wrap">{r.justification}</p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
          Virtual machines ({r.vmSpecs.length})
        </div>
        {r.vmSpecs.length === 0 ? (
          <div className="text-sm text-muted">No VMs requested.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>vCPU</th>
                  <th>RAM (GB)</th>
                  <th>Disk (GB)</th>
                  <th>OS</th>
                  <th>Hostname</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {r.vmSpecs.map((v, i) => (
                  <tr key={v.id}>
                    <td>{i + 1}</td>
                    <td className="font-medium">{v.name}</td>
                    <td>{v.purpose ?? "—"}</td>
                    <td>{v.cpu}</td>
                    <td>{v.memoryGB}</td>
                    <td>{v.storageGB}</td>
                    <td>{v.osImage ?? "—"}</td>
                    <td>
                      {v.hostname ?? <span className="text-muted">pending</span>}
                    </td>
                    <td>
                      {v.ipAddress ?? <span className="text-muted">pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5 border-accent/40 shadow-glow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sigma size={16} className="text-accent" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Total infrastructure requirement
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Totl label="VMs" value={r.vmSpecs.length} />
          <Totl label="Total vCPU" value={`${totals.cpu} cores`} hint={`${sumVm.cpu} VM + ${k8sCpu} k8s`} />
          <Totl label="Total memory" value={`${totals.mem} GB`} hint={`${sumVm.mem} VM + ${k8sMem} k8s`} />
          <Totl
            label="Total storage"
            value={`${totals.storage} GB`}
            hint={`${sumVm.disk} VM + ${k8sStore} k8s + ${shared} shared`}
          />
          {r.needsK8s && (
            <Totl label="Utility services" value={r.utilityServices.length} />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Block title="Kubernetes">
          <KV k="Required" v={r.needsK8s ? "yes" : "no"} />
          {r.needsK8s && (
            <>
              <KV k="Namespace" v={r.k8sNamespace} />
              <KV k="Quota CPU" v={r.nsQuotaCpu ? `${r.nsQuotaCpu} cores` : null} />
              <KV k="Quota memory" v={r.nsQuotaMemoryGB ? `${r.nsQuotaMemoryGB} GB` : null} />
              <KV k="Quota storage" v={r.nsQuotaStorageGB ? `${r.nsQuotaStorageGB} GB` : null} />
              <dt className="text-muted">Utility services</dt>
              <dd>
                {r.utilityServices.length === 0
                  ? "—"
                  : (
                    <div className="flex flex-wrap gap-1">
                      {r.utilityServices.map((s) => (
                        <span key={s} className="chip">{s}</span>
                      ))}
                    </div>
                  )}
              </dd>
            </>
          )}
        </Block>
        <Block title="Network & storage">
          <KV k="Load balancer" v={r.needsLoadBalancer ? "yes" : "no"} />
          <KV k="Public IP" v={r.needsPublicIp ? "yes" : "no"} />
          <KV k="Database" v={r.needsDatabase ? r.databaseEngine ?? "yes" : "no"} />
          <KV k="Shared storage (GB)" v={r.storageGB} />
        </Block>
        <Block title="Lifecycle & ownership">
          <KV k="Start" v={fmtDate(r.startDate)} />
          <KV k="Tenure" v={`${r.tenureDays} days`} />
          <KV k="Expiry" v={fmtDate(r.expiryDate)} />
          <KV k="Manager" v={`${r.managerName} <${r.managerEmail}>`} />
          <KV k="Cost center" v={r.costCenter} />
        </Block>
        <Block title="Provisioning record">
          <KV k="Provisioned at" v={fmtDate(r.provisionedAt)} />
          <KV k="Namespace (actual)" v={r.provisionedNamespace} />
          <KV k="Notes" v={r.provisioningNotes} />
        </Block>
      </div>

      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">Attachments</div>
        {r.attachments.length === 0 ? (
          <div className="text-sm text-muted">No attachments.</div>
        ) : (
          <ul className="divide-y divide-border/70">
            {r.attachments.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Paperclip size={14} className="text-muted" />
                  <span className="font-medium">{a.originalName}</span>
                  <span className="text-xs text-muted">
                    {a.kind} · {(a.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </div>
                <a className="btn btn-ghost" href={`/api/attachments/${a.id}`}>
                  <Download size={14} /> Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isInfra && (
        <ProvisioningPanel
          id={r.id}
          vms={r.vmSpecs.map((v) => ({
            id: v.id,
            name: v.name,
            hostname: v.hostname,
            ipAddress: v.ipAddress,
            notes: v.notes,
          }))}
          provisionedNamespace={r.provisionedNamespace}
          provisioningNotes={r.provisioningNotes}
        />
      )}

      {isInfra && <StatusActions id={r.id} status={r.status} />}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">Activity</div>
          <ul className="space-y-2">
            {r.events.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="text-xs text-muted">
                  {fmtDate(e.createdAt)} · {e.actorEmail ?? "system"}
                </div>
                <div>
                  <span className="chip mr-2">{e.type}</span>
                  {e.message}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
            Alert history
          </div>
          {r.alertLogs.length === 0 ? (
            <div className="text-sm text-muted">No alerts sent.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {r.alertLogs.map((a) => (
                <li key={a.id}>
                  <div className="text-xs text-muted">{fmtDate(a.sentAt)}</div>
                  <div>
                    <span className="chip mr-2">{a.kind}</span>
                    {a.subject}
                  </div>
                  <div className="text-xs text-muted truncate">→ {a.recipients}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">{title}</div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">{children}</dl>
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

function KV({ k, v }: { k: string; v: any }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
    </>
  );
}
