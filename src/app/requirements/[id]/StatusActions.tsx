"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const NEXT: Record<string, string[]> = {
  SUBMITTED: ["IN_REVIEW", "APPROVED", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PROVISIONED"],
  PROVISIONED: ["EXPIRED"],
  EXPIRED: ["SHUTDOWN", "PROVISIONED"],
  REJECTED: [],
  SHUTDOWN: [],
  DRAFT: ["SUBMITTED"],
};

export function StatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const next = NEXT[status] ?? [];
  if (next.length === 0) return null;

  async function transition(to: string) {
    setBusy(to);
    try {
      const res = await fetch(`/api/requirements/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, note: note || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
        Infra actions
      </div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
        <textarea
          className="field"
          placeholder="Optional note for the activity log"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {next.map((s) => (
            <button
              key={s}
              className="btn"
              disabled={!!busy}
              onClick={() => transition(s)}
            >
              {busy === s && <Loader2 size={14} className="animate-spin" />}
              Move to {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
