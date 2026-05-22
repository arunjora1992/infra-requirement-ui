"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlertConfig } from "@prisma/client";
import { Loader2, Save } from "lucide-react";

export function AlertConfigForm({ initial }: { initial: AlertConfig }) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial);
  const [ccText, setCcText] = useState(initial.ccEmails.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update<K extends keyof AlertConfig>(k: K, v: AlertConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const cc = ccText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/alert-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: cfg.enabled,
          cronExpression: cfg.cronExpression,
          preExpiryDays: cfg.preExpiryDays,
          postExpiryReminderDays: cfg.postExpiryReminderDays,
          shutdownAfterDays: cfg.shutdownAfterDays,
          ccEmails: cc,
          notifyInfra: cfg.notifyInfra,
          notifyManager: cfg.notifyManager,
          notifyRaiser: cfg.notifyRaiser,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const e = data.error;
        throw new Error(
          typeof e === "string"
            ? e
            : Object.values(e?.fieldErrors ?? {}).flat().join("\n") || JSON.stringify(e),
        );
      }
      setMsg("Saved. Scheduler reloaded.");
      router.refresh();
    } catch (e: any) {
      setMsg(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
        Alert configuration
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[rgb(var(--accent))]"
            checked={cfg.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          <span>Scheduler enabled</span>
        </label>
        <label>
          <span className="label">Cron expression</span>
          <input
            className="field font-mono"
            value={cfg.cronExpression}
            onChange={(e) => update("cronExpression", e.target.value)}
            placeholder="0 9 * * *"
          />
          <span className="text-[11px] text-muted">
            Standard 5-field cron. Default <code>0 9 * * *</code> (09:00 daily).
          </span>
        </label>

        <label>
          <span className="label">Pre-expiry warning (days before)</span>
          <input
            type="number"
            min={1}
            max={60}
            className="field"
            value={cfg.preExpiryDays}
            onChange={(e) => update("preExpiryDays", Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">Post-expiry daily reminder (days after)</span>
          <input
            type="number"
            min={0}
            max={30}
            className="field"
            value={cfg.postExpiryReminderDays}
            onChange={(e) =>
              update("postExpiryReminderDays", Number(e.target.value))
            }
          />
        </label>
        <label>
          <span className="label">Shutdown notice (days after expiry)</span>
          <input
            type="number"
            min={1}
            max={60}
            className="field"
            value={cfg.shutdownAfterDays}
            onChange={(e) => update("shutdownAfterDays", Number(e.target.value))}
          />
        </label>
      </div>

      <div>
        <span className="label">Always CC (comma-separated emails)</span>
        <input
          className="field"
          value={ccText}
          onChange={(e) => setCcText(e.target.value)}
          placeholder="ops@example.com, manager@example.com"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <Toggle
          label="Notify raiser"
          checked={cfg.notifyRaiser}
          onChange={(v) => update("notifyRaiser", v)}
        />
        <Toggle
          label="Notify manager"
          checked={cfg.notifyManager}
          onChange={(v) => update("notifyManager", v)}
        />
        <Toggle
          label="Notify infra team"
          checked={cfg.notifyInfra}
          onChange={(v) => update("notifyInfra", v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">
          Changes apply within ~5 minutes (or immediately after save).
        </div>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {msg && <div className="text-sm text-muted">{msg}</div>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        className="w-4 h-4 accent-[rgb(var(--accent))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
