"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Plug, Trash2 } from "lucide-react";

export type ClusterRow = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  insecureTls: boolean;
  enabled: boolean;
  hasPassword: boolean;
  cpuCoresTotal: number | null;
  cpuCoresUsed: number | null;
  memoryGBTotal: number | null;
  memoryGBAvailable: number | null;
  storageGBTotal: number | null;
  storageGBAvailable: number | null;
  lastSyncedAt: Date | string | null;
  lastError: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 16).replace("T", " ");
}

export function ClustersPanel({ initial }: { initial: ClusterRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    baseUrl: "",
    username: "",
    password: "",
    insecureTls: false,
  });

  async function add() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      setDraft({ name: "", baseUrl: "", username: "", password: "", insecureTls: false });
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function action(id: string, path: string, method: "POST" | "PATCH" | "DELETE", body?: any) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clusters/${id}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
          Add oVirt / RHEV cluster
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Display name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="DC1 oVirt" />
          <Field label="Base URL" value={draft.baseUrl} onChange={(v) => setDraft({ ...draft, baseUrl: v })} placeholder="https://ovirt.example.com" />
          <Field label="Username" value={draft.username} onChange={(v) => setDraft({ ...draft, username: v })} placeholder="admin@internal" />
          <Field label="Password" type="password" value={draft.password} onChange={(v) => setDraft({ ...draft, password: v })} />
          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[rgb(var(--accent))]"
              checked={draft.insecureTls}
              onChange={(e) => setDraft({ ...draft, insecureTls: e.target.checked })}
            />
            <span className="text-sm">Skip TLS verification (self-signed cert)</span>
          </label>
          <div className="flex items-end justify-end">
            <button className="btn btn-primary" onClick={add} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add cluster
            </button>
          </div>
        </div>
        {error && (
          <div className="text-sm text-danger mt-2 whitespace-pre-wrap">{error}</div>
        )}
      </div>

      <div className="grid gap-3">
        {initial.length === 0 && (
          <div className="card p-6 text-center text-muted text-sm">
            No clusters configured. Add one above so the form can show capacity.
          </div>
        )}
        {initial.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  {c.username} @ {c.baseUrl}
                  {c.insecureTls && <span className="ml-2 chip">insecure-tls</span>}
                </div>
                <div className="text-lg font-semibold mt-1">{c.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  Last synced: {fmtDate(c.lastSyncedAt)}
                </div>
                {c.lastError && (
                  <div className="text-xs text-danger mt-1">
                    Last error: {c.lastError}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn"
                  disabled={busyId === c.id}
                  onClick={() => action(c.id, "/test", "POST")}
                  title="Test connection"
                >
                  <Plug size={14} /> Test
                </button>
                <button
                  className="btn"
                  disabled={busyId === c.id}
                  onClick={() => action(c.id, "/refresh", "POST")}
                  title="Refresh capacity"
                >
                  {busyId === c.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Refresh
                </button>
                <button
                  className="btn"
                  onClick={() => action(c.id, "", "PATCH", { enabled: !c.enabled })}
                >
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  className="btn btn-ghost btn-danger"
                  onClick={() => {
                    if (confirm(`Delete cluster ${c.name}?`)) action(c.id, "", "DELETE");
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              <Capacity
                label="CPU cores"
                total={c.cpuCoresTotal}
                used={c.cpuCoresUsed}
              />
              <Capacity
                label="Memory (GB)"
                total={c.memoryGBTotal}
                used={
                  c.memoryGBTotal !== null && c.memoryGBAvailable !== null
                    ? c.memoryGBTotal - c.memoryGBAvailable
                    : null
                }
              />
              <Capacity
                label="Storage (GB)"
                total={c.storageGBTotal}
                used={
                  c.storageGBTotal !== null && c.storageGBAvailable !== null
                    ? c.storageGBTotal - c.storageGBAvailable
                    : null
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Capacity({
  label,
  total,
  used,
}: {
  label: string;
  total: number | null;
  used: number | null;
}) {
  const t = total ?? 0;
  const u = used ?? 0;
  const free = Math.max(0, t - u);
  const pct = t > 0 ? Math.round((u / t) * 100) : 0;
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="text-xl font-semibold mt-1">
        {total === null ? "—" : `${free} free`}
      </div>
      <div className="text-[10px] text-muted mt-0.5">
        {total === null ? "not synced yet" : `${u} / ${t} used (${pct}%)`}
      </div>
      {total !== null && t > 0 && (
        <div className="h-1.5 rounded-full bg-border/60 mt-2 overflow-hidden">
          <div
            className="h-full bg-accent-gradient"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
