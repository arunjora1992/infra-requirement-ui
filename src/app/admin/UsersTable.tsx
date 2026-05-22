"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@prisma/client";

const ROLES = ["USER", "MANAGER", "INFRA", "ADMIN"] as const;

export function UsersTable({ users }: { users: User[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(id: string, body: Partial<{ role: string; team: string }>) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) alert(await res.text());
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Team</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={busyId === u.id ? "opacity-60" : ""}>
              <td>{u.email}</td>
              <td>{u.name ?? "—"}</td>
              <td>
                <input
                  defaultValue={u.team ?? ""}
                  className="field max-w-[180px]"
                  placeholder="team"
                  onBlur={(e) => {
                    if (e.target.value !== (u.team ?? "")) {
                      patch(u.id, { team: e.target.value });
                    }
                  }}
                />
              </td>
              <td>
                <select
                  className="field max-w-[140px]"
                  defaultValue={u.role}
                  onChange={(e) => patch(u.id, { role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="text-sm text-muted whitespace-nowrap">
                {new Date(u.createdAt).toISOString().slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
