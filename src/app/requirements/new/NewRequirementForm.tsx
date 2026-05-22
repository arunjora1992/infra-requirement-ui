"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Send,
  Loader2,
  Plus,
  Trash2,
  Sigma,
  AlertTriangle,
  Activity,
  Info,
} from "lucide-react";
import { UTILITY_SERVICES } from "@/lib/constants";

type OptionsBundle = {
  modules: { id: string; name: string }[];
  managers: { id: string; name: string; email: string }[];
  osVersions: { id: string; name: string }[];
};

type CapacityPrivileged = {
  hasData: boolean;
  isPrivileged: true;
  totals: {
    cpuCoresTotal: number;
    cpuCoresAvailable: number;
    memoryGBTotal: number;
    memoryGBAvailable: number;
    storageGBTotal: number;
    storageGBAvailable: number;
  };
  clusters: { id: string; name: string; lastSyncedAt: string | null }[];
};
type CapacityRegular = {
  hasData: boolean;
  isPrivileged: false;
  availability: { cpu: number; memory: number; storage: number };
};
type CapacityBundle = CapacityPrivileged | CapacityRegular;

type VmRow = {
  name: string;
  purpose: string;
  cpu: string;
  memoryGB: string;
  storageGB: string;
  osImage: string;
};

const blankVm = (n: number): VmRow => ({
  name: `vm-${n}`,
  purpose: "",
  cpu: "2",
  memoryGB: "4",
  storageGB: "40",
  osImage: "",
});

export function NewRequirementForm({ defaultProject }: { defaultProject: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [vms, setVms] = useState<VmRow[]>([blankVm(1)]);
  const [needsK8s, setNeedsK8s] = useState(false);
  const [utilities, setUtilities] = useState<string[]>([]);
  const [nsCpu, setNsCpu] = useState("");
  const [nsMem, setNsMem] = useState("");
  const [nsStore, setNsStore] = useState("");
  const [sharedStore, setSharedStore] = useState("");
  const [options, setOptions] = useState<OptionsBundle>({
    modules: [],
    managers: [],
    osVersions: [],
  });
  const [capacity, setCapacity] = useState<CapacityBundle | null>(null);
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/options")
      .then((r) => r.json())
      .then((d) => !cancelled && setOptions(d))
      .catch(() => {});
    fetch("/api/capacity")
      .then((r) => r.json())
      .then((d) => !cancelled && setCapacity(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function pickManager(email: string) {
    const m = options.managers.find((x) => x.email === email);
    if (m) {
      setManagerEmail(m.email);
      setManagerName(m.name);
    }
  }

  const totals = useMemo(() => {
    const sumVmCpu = vms.reduce((a, v) => a + (Number(v.cpu) || 0), 0);
    const sumVmMem = vms.reduce((a, v) => a + (Number(v.memoryGB) || 0), 0);
    const sumVmDisk = vms.reduce((a, v) => a + (Number(v.storageGB) || 0), 0);
    const k8sCpu = needsK8s ? Number(nsCpu) || 0 : 0;
    const k8sMem = needsK8s ? Number(nsMem) || 0 : 0;
    const k8sStore = needsK8s ? Number(nsStore) || 0 : 0;
    const shared = Number(sharedStore) || 0;
    return {
      vmCount: vms.length,
      vmCpu: sumVmCpu,
      vmMem: sumVmMem,
      vmDisk: sumVmDisk,
      k8sCpu,
      k8sMem,
      k8sStore,
      shared,
      totalCpu: sumVmCpu + k8sCpu,
      totalMem: sumVmMem + k8sMem,
      totalStorage: sumVmDisk + k8sStore + shared,
      utilities: needsK8s ? utilities.length : 0,
    };
  }, [vms, needsK8s, nsCpu, nsMem, nsStore, sharedStore, utilities]);

  function updateVm(i: number, patch: Partial<VmRow>) {
    setVms((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addVm() {
    setVms((prev) => [...prev, blankVm(prev.length + 1)]);
  }
  function removeVm(i: number) {
    setVms((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleUtility(name: string) {
    setUtilities((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const obj: Record<string, any> = {};
      fd.forEach((v, k) => {
        if (typeof v === "string") obj[k] = v === "" ? undefined : v;
      });
      ["needsLoadBalancer", "needsPublicIp", "needsDatabase"].forEach((k) => {
        obj[k] = fd.get(k) === "on";
      });

      obj.needsK8s = needsK8s;
      obj.utilityServices = needsK8s ? utilities : [];
      obj.vmSpecs = vms.map((v) => ({
        name: v.name.trim(),
        purpose: v.purpose.trim() || undefined,
        cpu: Number(v.cpu),
        memoryGB: Number(v.memoryGB),
        storageGB: Number(v.storageGB),
        osImage: v.osImage.trim() || undefined,
      }));

      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      });
      const data = await res.json();
      if (!res.ok) {
        const e = data.error;
        if (typeof e === "object") {
          const msgs = Object.values(e.fieldErrors ?? {})
            .flat()
            .concat(e.formErrors ?? []);
          throw new Error(msgs.join("\n") || JSON.stringify(e));
        }
        throw new Error(String(e ?? "Failed"));
      }
      const id = data.item.id as string;

      if (boqFile) {
        const upload = new FormData();
        upload.set("file", boqFile);
        upload.set("kind", "BOQ");
        const ur = await fetch(`/api/requirements/${id}/attachments`, {
          method: "POST",
          body: upload,
        });
        if (!ur.ok) {
          const u = await ur.json();
          throw new Error(u.error ?? "BoQ upload failed");
        }
      }

      router.push(`/requirements/${id}`);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <datalist id="os-options">
        {options.osVersions.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>

      <CapacityBanner capacity={capacity} totals={totals} />

      <Section title="Requirement" required>
        <Field label="Title *" name="title" required placeholder="e.g. Billing service cluster" />
        <Field label="Project name *" name="projectName" required defaultValue={defaultProject} />
        <label>
          <span className="label">Module name</span>
          <input
            list="module-options"
            name="moduleName"
            className="field"
            placeholder={
              options.modules.length === 0
                ? "Ask admin to add modules"
                : "Choose or type"
            }
          />
          <datalist id="module-options">
            {options.modules.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </label>
        <Select label="Environment *" name="environment" required options={["DEV", "STAGING", "PROD", "DR"]} defaultValue="DEV" />
        <Select label="Priority" name="priority" options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} defaultValue="MEDIUM" />
        <TextArea label="Description" name="description" className="md:col-span-2" placeholder="What is this for?" />
        <TextArea label="Business justification *" name="justification" required minLength={10} className="md:col-span-2" placeholder="Why does this need to be provisioned?" />
      </Section>

      <Section title="Virtual machines">
        <div className="md:col-span-2 space-y-3">
          {vms.map((v, i) => (
            <div key={i} className="card p-4 grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
              <label className="md:col-span-1">
                <span className="label">Name *</span>
                <input className="field" required value={v.name} onChange={(e) => updateVm(i, { name: e.target.value })} />
              </label>
              <label className="md:col-span-2">
                <span className="label">Purpose</span>
                <input className="field" value={v.purpose} onChange={(e) => updateVm(i, { purpose: e.target.value })} placeholder="Web, DB, …" />
              </label>
              <label>
                <span className="label">vCPU *</span>
                <input className="field" type="number" min={1} required value={v.cpu} onChange={(e) => updateVm(i, { cpu: e.target.value })} />
              </label>
              <label>
                <span className="label">RAM GB *</span>
                <input className="field" type="number" min={1} required value={v.memoryGB} onChange={(e) => updateVm(i, { memoryGB: e.target.value })} />
              </label>
              <label>
                <span className="label">Disk GB *</span>
                <input className="field" type="number" min={1} required value={v.storageGB} onChange={(e) => updateVm(i, { storageGB: e.target.value })} />
              </label>
              <div className="flex gap-2 items-end">
                <label className="flex-1">
                  <span className="label">OS image</span>
                  <input
                    list="os-options"
                    className="field"
                    value={v.osImage}
                    onChange={(e) => updateVm(i, { osImage: e.target.value })}
                    placeholder={options.osVersions.length === 0 ? "type / pick" : "pick or type"}
                  />
                </label>
                {vms.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-danger" onClick={() => removeVm(i)} title="Remove VM">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={addVm}>
            <Plus size={14} /> Add VM
          </button>
        </div>
      </Section>

      <Section title="Kubernetes">
        <label className="md:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[rgb(var(--accent))]"
            checked={needsK8s}
            onChange={(e) => setNeedsK8s(e.target.checked)}
          />
          <span>This requirement needs a Kubernetes namespace</span>
        </label>
        {needsK8s && (
          <>
            <Field label="Namespace *" name="k8sNamespace" required placeholder="billing-prod" />
            <Field
              label="Total CPU (cores) *"
              name="nsQuotaCpu"
              type="number"
              min={1}
              required
              placeholder="16"
              value={nsCpu}
              onChange={(e) => setNsCpu(e.target.value)}
            />
            <Field
              label="Total memory (GB) *"
              name="nsQuotaMemoryGB"
              type="number"
              min={1}
              required
              placeholder="64"
              value={nsMem}
              onChange={(e) => setNsMem(e.target.value)}
            />
            <Field
              label="Total storage (GB)"
              name="nsQuotaStorageGB"
              type="number"
              min={0}
              placeholder="200"
              value={nsStore}
              onChange={(e) => setNsStore(e.target.value)}
            />
            <div className="md:col-span-2">
              <span className="label">Utility services in this namespace</span>
              <div className="flex flex-wrap gap-2">
                {UTILITY_SERVICES.map((svc) => {
                  const active = utilities.includes(svc);
                  return (
                    <button
                      type="button"
                      key={svc}
                      onClick={() => toggleUtility(svc)}
                      className={
                        "chip cursor-pointer transition " +
                        (active
                          ? "border-accent text-white bg-accent-gradient shadow-glow-sm"
                          : "")
                      }
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-2">
                Click to toggle. Selected services will be deployed inside the requested namespace.
              </p>
            </div>
          </>
        )}
      </Section>

      <Section title="Network & shared storage">
        <Checkbox label="Load balancer" name="needsLoadBalancer" />
        <Checkbox label="Public IP" name="needsPublicIp" />
        <Checkbox label="Managed database" name="needsDatabase" />
        <Field label="DB engine" name="databaseEngine" placeholder="postgres-16" />
        <Field
          label="Shared storage (GB)"
          name="storageGB"
          type="number"
          min={0}
          value={sharedStore}
          onChange={(e) => setSharedStore(e.target.value)}
        />
      </Section>

      <Section title="Lifecycle & ownership" required>
        <Field label="Start date" name="startDate" type="date" />
        <Field label="Tenure (days) *" name="tenureDays" type="number" min={1} defaultValue={90} required />
        <Field label="Cost center" name="costCenter" placeholder="CC-1234" />
        <label className="md:col-span-2">
          <span className="label">Choose manager from list</span>
          <select
            className="field"
            value={managerEmail}
            onChange={(e) => pickManager(e.target.value)}
          >
            <option value="">— select —</option>
            {options.managers.map((m) => (
              <option key={m.id} value={m.email}>
                {m.name} &lt;{m.email}&gt;
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Manager name *"
          name="managerName"
          required
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
        />
        <Field
          label="Manager email *"
          name="managerEmail"
          type="email"
          required
          placeholder="manager@company.com"
          value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
        />
      </Section>

      <Section title="Bill of Quantities (BoQ)">
        <label className="md:col-span-2">
          <span className="label">BoQ document (PDF / XLSX / DOCX, max 25 MB)</span>
          <div className="flex items-center gap-3">
            <label className="btn cursor-pointer">
              <Upload size={14} />
              <span>{boqFile ? "Replace file" : "Choose file"}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.txt,.zip"
                onChange={(e) => setBoqFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {boqFile && (
              <span className="text-sm text-muted">
                {boqFile.name} · {(boqFile.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
        </label>
      </Section>

      <div className="card p-5 border-accent/40 shadow-glow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sigma size={16} className="text-accent" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Total infrastructure requirement
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="VMs" value={totals.vmCount} />
          <Stat
            label="Total vCPU"
            value={`${totals.totalCpu} cores`}
            hint={`${totals.vmCpu} VM + ${totals.k8sCpu} k8s`}
            warn={overFor(capacity, "cpu", totals.totalCpu)}
            available={availableLabel(capacity, "cpu")}
          />
          <Stat
            label="Total memory"
            value={`${totals.totalMem} GB`}
            hint={`${totals.vmMem} VM + ${totals.k8sMem} k8s`}
            warn={overFor(capacity, "memory", totals.totalMem)}
            available={availableLabel(capacity, "memory")}
          />
          <Stat
            label="Total storage"
            value={`${totals.totalStorage} GB`}
            hint={`${totals.vmDisk} VM + ${totals.k8sStore} k8s + ${totals.shared} shared`}
            warn={overFor(capacity, "storage", totals.totalStorage)}
            available={availableLabel(capacity, "storage")}
          />
          {needsK8s && (
            <Stat label="Utility services" value={totals.utilities} />
          )}
        </div>
        <CapacityWarning capacity={capacity} totals={totals} />
      </div>

      {error && (
        <div className="card p-4 text-sm text-danger whitespace-pre-wrap">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => history.back()}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {busy ? "Submitting…" : "Submit requirement"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
  required,
}: {
  title: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{title}</div>
        {required && (
          <span className="chip" style={{ color: "rgb(var(--danger))" }}>
            required
          </span>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  className?: string;
};

function Field({ label, className, ...rest }: FieldProps) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <input className="field" {...rest} />
    </label>
  );
}

function TextArea({
  label,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <textarea rows={3} className="field" {...rest} />
    </label>
  );
}

function Select({
  label,
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" {...rest}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
  available,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
  available?: string;
}) {
  return (
    <div
      className={
        "rounded-xl border p-3 " +
        (warn
          ? "border-warning bg-warning/10"
          : "border-border/70 bg-surface-2/50")
      }
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
        {warn && <AlertTriangle size={12} className="text-warning" />}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
      {available && (
        <div className={`text-[10px] mt-0.5 ${warn ? "text-warning" : "text-muted"}`}>
          {available}
        </div>
      )}
    </div>
  );
}

function overFor(
  capacity: CapacityBundle | null,
  kind: "cpu" | "memory" | "storage",
  requested: number,
): boolean {
  if (!capacity?.hasData) return false;
  if (capacity.isPrivileged) {
    if (kind === "cpu") return requested > capacity.totals.cpuCoresAvailable;
    if (kind === "memory") return requested > capacity.totals.memoryGBAvailable;
    return requested > capacity.totals.storageGBAvailable;
  }
  if (kind === "cpu") return requested > capacity.availability.cpu;
  if (kind === "memory") return requested > capacity.availability.memory;
  return requested > capacity.availability.storage;
}

function availableLabel(
  capacity: CapacityBundle | null,
  kind: "cpu" | "memory" | "storage",
): string | undefined {
  if (!capacity?.hasData) return undefined;
  if (!capacity.isPrivileged) return undefined; // never reveal numbers
  if (kind === "cpu") return `${capacity.totals.cpuCoresAvailable} avail.`;
  if (kind === "memory") return `${capacity.totals.memoryGBAvailable} avail.`;
  return `${capacity.totals.storageGBAvailable} avail.`;
}

function CapacityBanner({
  capacity,
  totals,
}: {
  capacity: CapacityBundle | null;
  totals: { totalCpu: number; totalMem: number; totalStorage: number };
}) {
  if (!capacity) {
    return (
      <div className="card p-4 text-sm text-muted flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Checking cluster capacity…
      </div>
    );
  }
  if (!capacity.hasData) {
    return (
      <div className="card p-4 text-sm flex items-start gap-2">
        <Info size={16} className="text-muted shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Cluster capacity not synced yet.</div>
          <div className="text-muted text-xs mt-0.5">
            Capacity checks will appear once an admin syncs an oVirt/RHEV cluster.
          </div>
        </div>
      </div>
    );
  }

  const cpuOver = overFor(capacity, "cpu", totals.totalCpu);
  const memOver = overFor(capacity, "memory", totals.totalMem);
  const stoOver = overFor(capacity, "storage", totals.totalStorage);
  const anyOver = cpuOver || memOver || stoOver;

  // Non-privileged users: never show available/total numbers, only a warning.
  if (!capacity.isPrivileged) {
    if (!anyOver) {
      return (
        <div className="card p-3 text-xs text-success/90 flex items-center gap-2 border-success/40">
          <Activity size={14} /> Your request fits within current cluster capacity.
        </div>
      );
    }
    const overKinds = [
      cpuOver && "CPU",
      memOver && "memory",
      stoOver && "storage",
    ].filter(Boolean);
    return (
      <div className="card p-4 border-warning/60 bg-warning/10 flex items-start gap-2">
        <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-warning">
            Insufficient cluster capacity for this requirement.
          </div>
          <div className="text-sm text-fg/90 mt-0.5">
            The requested {overKinds.join(", ")} exceeds what is currently
            available across the infrastructure. You can still submit — the
            infra team will review and either provision now or queue until
            capacity is added.
          </div>
        </div>
      </div>
    );
  }

  // Privileged (INFRA/ADMIN) view: full capacity breakdown with numbers.
  const lastSync = capacity.clusters
    .map((c) => c.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .pop();
  return (
    <div
      className={`card p-5 ${anyOver ? "border-warning/60 bg-warning/5" : "border-success/40"}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className={anyOver ? "text-warning" : "text-success"} />
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Cluster availability (live · infra view)
          </div>
        </div>
        <div className="text-[11px] text-muted">
          {capacity.clusters.length} cluster(s) · last sync:{" "}
          {lastSync ? new Date(lastSync).toLocaleString() : "never"}
          {" "}· refreshes hourly
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AvailCell
          label="CPU cores"
          available={capacity.totals.cpuCoresAvailable}
          total={capacity.totals.cpuCoresTotal}
          requested={totals.totalCpu}
          over={cpuOver}
        />
        <AvailCell
          label="Memory (GB)"
          available={capacity.totals.memoryGBAvailable}
          total={capacity.totals.memoryGBTotal}
          requested={totals.totalMem}
          over={memOver}
        />
        <AvailCell
          label="Storage (GB)"
          available={capacity.totals.storageGBAvailable}
          total={capacity.totals.storageGBTotal}
          requested={totals.totalStorage}
          over={stoOver}
        />
      </div>
      <div className="text-[11px] text-muted mt-3 flex items-start gap-1">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          CPU + memory are reservation-based (sum of running VM allocations).
          Storage uses storage-domain available bytes. Refreshes every hour.
        </span>
      </div>
    </div>
  );
}

function AvailCell({
  label,
  available,
  total,
  requested,
  over,
}: {
  label: string;
  available: number;
  total: number;
  requested: number;
  over: boolean;
}) {
  const pctFree = total > 0 ? (available / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/50 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
        {over && <AlertTriangle size={12} className="text-warning" />}
      </div>
      <div className={`text-xl font-semibold mt-1 ${over ? "text-warning" : ""}`}>
        {available.toLocaleString()}
        <span className="text-xs text-muted ml-1 font-normal">/ {total.toLocaleString()} free</span>
      </div>
      <div className="text-[10px] text-muted mt-0.5">
        requested: {requested.toLocaleString()}
        {over ? (
          <span className="text-warning ml-1">
            (over by {(requested - available).toLocaleString()})
          </span>
        ) : null}
      </div>
      <div className="h-1.5 rounded-full bg-border/60 mt-2 overflow-hidden">
        <div
          className={`h-full ${over ? "bg-warning" : "bg-success"}`}
          style={{ width: `${Math.min(100, pctFree)}%` }}
        />
      </div>
    </div>
  );
}

function CapacityWarning({
  capacity,
  totals,
}: {
  capacity: CapacityBundle | null;
  totals: { totalCpu: number; totalMem: number; totalStorage: number };
}) {
  if (!capacity?.hasData) return null;
  const cpuOver = overFor(capacity, "cpu", totals.totalCpu);
  const memOver = overFor(capacity, "memory", totals.totalMem);
  const stoOver = overFor(capacity, "storage", totals.totalStorage);
  if (!cpuOver && !memOver && !stoOver) return null;

  // Privileged users see exact "over by N" in the banner above.
  // Regular users only see a generic warning here.
  if (!capacity.isPrivileged) {
    return (
      <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-warning/50 bg-warning/10 text-sm">
        <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-warning">
            Insufficient capacity for this requirement.
          </div>
          <div className="text-[11px] text-muted mt-1">
            Submit anyway — the infra team will review.
          </div>
        </div>
      </div>
    );
  }

  const overs: string[] = [];
  if (cpuOver)
    overs.push(`${totals.totalCpu - capacity.totals.cpuCoresAvailable} core(s) over CPU`);
  if (memOver)
    overs.push(`${totals.totalMem - capacity.totals.memoryGBAvailable} GB over memory`);
  if (stoOver)
    overs.push(`${totals.totalStorage - capacity.totals.storageGBAvailable} GB over storage`);
  return (
    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-warning/50 bg-warning/10 text-sm">
      <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold text-warning">
          Requested capacity exceeds what is currently available.
        </div>
        <ul className="list-disc ml-5 mt-1 text-warning/90 text-xs">
          {overs.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2">
      <input type="checkbox" name={name} className="w-4 h-4 accent-[rgb(var(--accent))]" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
