"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

type VmRow = {
  id: string;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  notes: string | null;
};

export function ProvisioningPanel({
  id,
  vms,
  provisionedNamespace,
  provisioningNotes,
}: {
  id: string;
  vms: VmRow[];
  provisionedNamespace: string | null;
  provisioningNotes: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<VmRow[]>(vms);
  const [ns, setNs] = useState(provisionedNamespace ?? "");
  const [notes, setNotes] = useState(provisioningNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(i: number, patch: Partial<VmRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/requirements/${id}/provisioning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provisionedNamespace: ns || null,
          provisioningNotes: notes || null,
          vms: rows.map((r) => ({
            id: r.id,
            hostname: r.hostname || null,
            ipAddress: r.ipAddress || null,
            notes: r.notes || null,
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(JSON.stringify(e.error ?? e));
      }
      setMsg("Saved.");
      router.refresh();
    } catch (e: any) {
      setMsg(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Infra provisioning details
        </div>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Saving…" : "Save provisioning"}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="table">
            <thead>
              <tr>
                <th>VM name</th>
                <th>Hostname</th>
                <th>IP address</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td>
                    <input
                      className="field"
                      value={r.hostname ?? ""}
                      onChange={(e) => update(i, { hostname: e.target.value })}
                      placeholder="vm01.prod.local"
                    />
                  </td>
                  <td>
                    <input
                      className="field"
                      value={r.ipAddress ?? ""}
                      onChange={(e) => update(i, { ipAddress: e.target.value })}
                      placeholder="10.0.0.10"
                    />
                  </td>
                  <td>
                    <input
                      className="field"
                      value={r.notes ?? ""}
                      onChange={(e) => update(i, { notes: e.target.value })}
                      placeholder="optional"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <label>
          <span className="label">Provisioned namespace</span>
          <input
            className="field"
            value={ns}
            onChange={(e) => setNs(e.target.value)}
            placeholder="billing-prod-abc"
          />
        </label>
        <label>
          <span className="label">Provisioning notes</span>
          <textarea
            rows={2}
            className="field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any caveats, links to runbooks, etc."
          />
        </label>
      </div>

      {msg && <div className="text-sm text-muted mt-3">{msg}</div>}
    </div>
  );
}
