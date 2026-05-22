import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/utils";
import { Download, Paperclip } from "lucide-react";
import { StatusActions } from "./StatusActions";

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

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              {r.team} · {r.environment} · {r.priority}
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

      <div className="grid md:grid-cols-2 gap-4">
        <Block title="Virtual machines">
          <KV k="Count" v={r.vmCount} />
          <KV k="vCPU / VM" v={r.vmCpu} />
          <KV k="RAM (GB) / VM" v={r.vmMemoryGB} />
          <KV k="Disk (GB) / VM" v={r.vmStorageGB} />
          <KV k="OS image" v={r.osImage} />
        </Block>
        <Block title="Kubernetes">
          <KV k="Pods" v={r.podCount} />
          <KV k="CPU / pod" v={r.podCpu} />
          <KV k="Memory / pod" v={r.podMemory} />
          <KV k="Cluster" v={r.k8sCluster} />
          <KV k="Namespace" v={r.k8sNamespace} />
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
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Attachments</div>
        </div>
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

function KV({ k, v }: { k: string; v: any }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
    </>
  );
}
