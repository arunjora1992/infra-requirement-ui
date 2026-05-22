"use client";

import { useState } from "react";
import type {
  User,
  Module,
  ManagerOption,
  OsVersion,
  AlertConfig,
} from "@prisma/client";
import { UsersTable } from "./UsersTable";
import { LookupTable } from "./LookupTable";
import { AlertConfigForm } from "./AlertConfigForm";
import { ClustersPanel, type ClusterRow } from "./ClustersPanel";

type Tab = "users" | "modules" | "managers" | "os" | "alerts" | "clusters";

export function AdminTabs({
  users,
  modules,
  managers,
  osVersions,
  alertConfig,
  clusters,
}: {
  users: User[];
  modules: Module[];
  managers: ManagerOption[];
  osVersions: OsVersion[];
  alertConfig: AlertConfig;
  clusters: ClusterRow[];
}) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")}>
          Users · {users.length}
        </TabBtn>
        <TabBtn active={tab === "modules"} onClick={() => setTab("modules")}>
          Modules · {modules.length}
        </TabBtn>
        <TabBtn active={tab === "managers"} onClick={() => setTab("managers")}>
          Managers · {managers.length}
        </TabBtn>
        <TabBtn active={tab === "os"} onClick={() => setTab("os")}>
          OS versions · {osVersions.length}
        </TabBtn>
        <TabBtn active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alerts
        </TabBtn>
        <TabBtn active={tab === "clusters"} onClick={() => setTab("clusters")}>
          Clusters · {clusters.length}
        </TabBtn>
      </div>

      {tab === "users" && <UsersTable users={users} />}

      {tab === "modules" && (
        <LookupTable
          title="Modules"
          endpoint="/api/admin/modules"
          items={modules.map((m) => ({ id: m.id, primary: m.name, active: m.active }))}
          placeholder="Module name (e.g. Billing, Catalog)"
          fields={[{ key: "name", label: "Name", required: true }]}
        />
      )}

      {tab === "managers" && (
        <LookupTable
          title="Managers"
          endpoint="/api/admin/managers"
          items={managers.map((m) => ({
            id: m.id,
            primary: m.name,
            secondary: m.email,
            active: m.active,
          }))}
          placeholder="Manager"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "email", label: "Email", required: true, type: "email" },
          ]}
        />
      )}

      {tab === "os" && (
        <LookupTable
          title="OS versions"
          endpoint="/api/admin/os-versions"
          items={osVersions.map((o) => ({ id: o.id, primary: o.name, active: o.active }))}
          placeholder="OS image (e.g. Rocky Linux 9, Ubuntu 22.04)"
          fields={[{ key: "name", label: "Name", required: true }]}
        />
      )}

      {tab === "alerts" && <AlertConfigForm initial={alertConfig} />}

      {tab === "clusters" && <ClustersPanel initial={clusters} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? "btn-primary" : ""}`}
      type="button"
    >
      {children}
    </button>
  );
}
