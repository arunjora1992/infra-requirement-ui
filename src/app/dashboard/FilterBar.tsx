"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const STATUSES = [
  "ALL",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "PROVISIONED",
  "EXPIRED",
  "SHUTDOWN",
  "REJECTED",
];

export function FilterBar({ canSeeAll }: { canSeeAll: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "ALL";
  const scope = sp.get("scope") ?? (canSeeAll ? "all" : "mine");
  const q = sp.get("q") ?? "";

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="card p-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          defaultValue={q}
          placeholder="Search title, team, manager…"
          className="field pl-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <select
        className="field max-w-[180px]"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "ALL" ? "All statuses" : s}
          </option>
        ))}
      </select>
      {canSeeAll && (
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            className={`px-3 py-2 text-sm ${scope === "all" ? "bg-accent text-white" : ""}`}
            onClick={() => setParam("scope", "all")}
          >
            All
          </button>
          <button
            className={`px-3 py-2 text-sm border-l border-border ${
              scope === "mine" ? "bg-accent text-white" : ""
            }`}
            onClick={() => setParam("scope", "mine")}
          >
            Mine
          </button>
        </div>
      )}
    </div>
  );
}
