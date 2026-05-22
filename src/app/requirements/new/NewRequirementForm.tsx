"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Send, Loader2 } from "lucide-react";

export function NewRequirementForm({ defaultTeam }: { defaultTeam: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boqFile, setBoqFile] = useState<File | null>(null);

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

      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
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
      <Section title="Requirement">
        <Field label="Title" name="title" required placeholder="e.g. K8s cluster for billing service" />
        <Field label="Team" name="team" required defaultValue={defaultTeam} />
        <Select
          label="Environment"
          name="environment"
          options={["DEV", "STAGING", "PROD", "DR"]}
        />
        <Select
          label="Priority"
          name="priority"
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
          defaultValue="MEDIUM"
        />
        <TextArea
          label="Description"
          name="description"
          placeholder="What is this for?"
          className="md:col-span-2"
        />
        <TextArea
          label="Business justification"
          name="justification"
          placeholder="Why does this need to be provisioned?"
          className="md:col-span-2"
        />
      </Section>

      <Section title="Virtual machines">
        <Field label="VM count" name="vmCount" type="number" min={0} defaultValue={0} />
        <Field label="vCPU / VM" name="vmCpu" type="number" min={0} />
        <Field label="RAM (GB) / VM" name="vmMemoryGB" type="number" min={0} />
        <Field label="Disk (GB) / VM" name="vmStorageGB" type="number" min={0} />
        <Field label="OS image" name="osImage" placeholder="Rocky 9, Ubuntu 22.04…" />
      </Section>

      <Section title="Kubernetes">
        <Field label="Pod count" name="podCount" type="number" min={0} defaultValue={0} />
        <Field label="Pod CPU" name="podCpu" placeholder="500m" />
        <Field label="Pod memory" name="podMemory" placeholder="1Gi" />
        <Field label="Cluster" name="k8sCluster" placeholder="prod-us-east" />
        <Field label="Namespace" name="k8sNamespace" placeholder="billing" />
      </Section>

      <Section title="Network &amp; storage">
        <Checkbox label="Load balancer" name="needsLoadBalancer" />
        <Checkbox label="Public IP" name="needsPublicIp" />
        <Checkbox label="Managed database" name="needsDatabase" />
        <Field label="DB engine" name="databaseEngine" placeholder="postgres-16" />
        <Field label="Shared storage (GB)" name="storageGB" type="number" min={0} />
      </Section>

      <Section title="Lifecycle &amp; ownership">
        <Field label="Start date" name="startDate" type="date" />
        <Field
          label="Tenure (days)"
          name="tenureDays"
          type="number"
          min={1}
          defaultValue={90}
          required
        />
        <Field label="Cost center" name="costCenter" placeholder="CC-1234" />
        <Field label="Manager name" name="managerName" required />
        <Field
          label="Manager email"
          name="managerEmail"
          type="email"
          required
          placeholder="manager@company.com"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div
        className="text-[11px] uppercase tracking-[0.2em] text-muted mb-4"
        dangerouslySetInnerHTML={{ __html: title }}
      />
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

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2">
      <input type="checkbox" name={name} className="w-4 h-4 accent-[rgb(var(--accent))]" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
