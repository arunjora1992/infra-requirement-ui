"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Send, Loader2, Plus, Trash2, Sigma } from "lucide-react";
import { UTILITY_SERVICES } from "@/lib/constants";

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
      <Section title="Requirement" required>
        <Field label="Title *" name="title" required placeholder="e.g. Billing service cluster" />
        <Field label="Project name *" name="projectName" required defaultValue={defaultProject} />
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
                  <input className="field" value={v.osImage} onChange={(e) => updateVm(i, { osImage: e.target.value })} placeholder="Rocky 9" />
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
        <Field label="Manager name *" name="managerName" required />
        <Field label="Manager email *" name="managerEmail" type="email" required placeholder="manager@company.com" />
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
          <Stat label="Total vCPU" value={`${totals.totalCpu} cores`} hint={`${totals.vmCpu} VM + ${totals.k8sCpu} k8s`} />
          <Stat label="Total memory" value={`${totals.totalMem} GB`} hint={`${totals.vmMem} VM + ${totals.k8sMem} k8s`} />
          <Stat
            label="Total storage"
            value={`${totals.totalStorage} GB`}
            hint={`${totals.vmDisk} VM + ${totals.k8sStore} k8s + ${totals.shared} shared`}
          />
          {needsK8s && (
            <Stat label="Utility services" value={totals.utilities} />
          )}
        </div>
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

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2">
      <input type="checkbox" name={name} className="w-4 h-4 accent-[rgb(var(--accent))]" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
