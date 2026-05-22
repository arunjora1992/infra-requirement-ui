"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Item = {
  id: string;
  primary: string;
  secondary?: string;
  active: boolean;
};

type FieldDef = { key: string; label: string; type?: string; required?: boolean };

export function LookupTable({
  title,
  endpoint,
  items,
  fields,
  placeholder,
}: {
  title: string;
  endpoint: string;
  items: Item[];
  fields: FieldDef[];
  placeholder: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(typeof e.error === "string" ? e.error : JSON.stringify(e.error));
      }
      setValues({});
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
          Add {title.toLowerCase()}
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          {fields.map((f) => (
            <label key={f.key}>
              <span className="label">{f.label}{f.required && " *"}</span>
              <input
                className="field"
                type={f.type ?? "text"}
                required={f.required}
                placeholder={f.label}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </label>
          ))}
          <button className="btn btn-primary" onClick={add} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
        {error && <div className="text-sm text-danger mt-2 whitespace-pre-wrap">{error}</div>}
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {items[0]?.secondary !== undefined && <th>Detail</th>}
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-8">
                  No entries yet. {placeholder}.
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id}>
                <td className="font-medium">{it.primary}</td>
                {it.secondary !== undefined && <td>{it.secondary}</td>}
                <td>
                  <button
                    className={`chip ${it.active ? "" : "text-muted"}`}
                    onClick={() => toggleActive(it.id, it.active)}
                  >
                    <span
                      className={`chip-dot ${it.active ? "bg-success" : "bg-muted"}`}
                    />
                    {it.active ? "active" : "inactive"}
                  </button>
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-ghost btn-danger"
                    onClick={() => remove(it.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
