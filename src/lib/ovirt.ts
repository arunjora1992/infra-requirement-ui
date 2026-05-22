import { Agent, fetch as undiciFetch } from "undici";
import type { OvirtCluster } from "@prisma/client";
import { decrypt } from "./crypto";

export type OvirtCapacity = {
  cpuCoresTotal: number;
  cpuCoresUsed: number;
  memoryGBTotal: number;
  memoryGBAvailable: number;
  storageGBTotal: number;
  storageGBAvailable: number;
};

function dispatcherFor(cluster: OvirtCluster) {
  if (!cluster.insecureTls) return undefined;
  return new Agent({ connect: { rejectUnauthorized: false } });
}

function authHeader(cluster: OvirtCluster) {
  const pwd = decrypt(cluster.passwordEnc);
  return "Basic " + Buffer.from(`${cluster.username}:${pwd}`).toString("base64");
}

function describeCause(err: any): string {
  const c = err?.cause;
  if (!c) return err?.message ?? String(err);
  const code = c.code || c.errno || "";
  const detail = c.message || c.reason || String(c);
  return `${err.message}${code ? ` [${code}]` : ""}${detail ? ` — ${detail}` : ""}`;
}

async function ovirtGet<T = any>(cluster: OvirtCluster, path: string): Promise<T> {
  const url = `${cluster.baseUrl.replace(/\/$/, "")}/ovirt-engine/api/${path.replace(/^\//, "")}`;
  let res;
  try {
    res = await undiciFetch(url, {
      headers: {
        Authorization: authHeader(cluster),
        Accept: "application/json",
        Version: "4",
      },
      dispatcher: dispatcherFor(cluster),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err: any) {
    throw new Error(`Cannot reach ${url}: ${describeCause(err)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const looksHtml = body.trimStart().toLowerCase().startsWith("<!doctype") ||
      body.trimStart().toLowerCase().startsWith("<html");
    if (looksHtml && res.status === 404) {
      throw new Error(
        `oVirt 404 at ${url} — base URL looks wrong. Set it to just the engine host (e.g. https://ovirt.example.com), without /ovirt-engine or /api.`,
      );
    }
    if (looksHtml && (res.status === 401 || res.status === 403)) {
      throw new Error(
        `oVirt returned the login HTML page (HTTP ${res.status}) — Basic auth may be disabled. Check the user has 'API' permission and that the username includes the auth profile, e.g. admin@internal or user@ovirt@internal.`,
      );
    }
    throw new Error(`oVirt ${res.status} ${res.statusText} – ${body.slice(0, 240)}`);
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.toLowerCase().includes("json")) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `oVirt returned non-JSON (${ctype || "no content-type"}). First 200 chars: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

const GB = 1024 ** 3;

function toInt(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function refreshAllClusters(prismaClient: typeof import("./db").prisma) {
  const clusters = await prismaClient.ovirtCluster.findMany({ where: { enabled: true } });
  const out: { id: string; name: string; ok: boolean; error?: string }[] = [];
  for (const c of clusters) {
    try {
      const cap = await fetchCapacity(c);
      await prismaClient.ovirtCluster.update({
        where: { id: c.id },
        data: { ...cap, lastSyncedAt: new Date(), lastError: null },
      });
      out.push({ id: c.id, name: c.name, ok: true });
    } catch (e: any) {
      await prismaClient.ovirtCluster.update({
        where: { id: c.id },
        data: { lastError: String(e?.message ?? e).slice(0, 500) },
      });
      out.push({ id: c.id, name: c.name, ok: false, error: String(e?.message ?? e) });
    }
  }
  return out;
}

export async function testConnection(cluster: OvirtCluster): Promise<{ ok: true; product?: string }> {
  const r = await ovirtGet<any>(cluster, "");
  return { ok: true, product: r?.product_info?.name ?? "oVirt" };
}

export async function fetchCapacity(cluster: OvirtCluster): Promise<OvirtCapacity> {
  // Reservation-based capacity:
  //  - Total CPU / memory: sum of UP host capacity
  //  - Reserved CPU / memory: sum of allocations across non-down VMs
  //  - Available = total - reserved
  //  - Storage available comes from storage domain "available" directly
  const hosts = await ovirtGet<any>(cluster, "hosts");
  const hostList: any[] = Array.isArray(hosts?.host) ? hosts.host : [];

  let cpuCoresTotal = 0;
  let memTotalBytes = 0;
  for (const h of hostList) {
    if (h.status && h.status !== "up") continue;
    const cores =
      toInt(h.cpu?.topology?.cores) *
      toInt(h.cpu?.topology?.sockets) *
      Math.max(1, toInt(h.cpu?.topology?.threads));
    cpuCoresTotal += cores;
    memTotalBytes += toInt(h.memory);
  }

  // Sum VM allocations. A "down" VM does not consume host CPU/RAM.
  const vms = await ovirtGet<any>(cluster, "vms");
  const vmList: any[] = Array.isArray(vms?.vm) ? vms.vm : [];

  let cpuCoresReserved = 0;
  let memReservedBytes = 0;
  for (const v of vmList) {
    if ((v.status ?? "").toLowerCase() === "down") continue;
    const cores =
      toInt(v.cpu?.topology?.cores) *
      toInt(v.cpu?.topology?.sockets) *
      Math.max(1, toInt(v.cpu?.topology?.threads));
    cpuCoresReserved += cores;
    memReservedBytes += toInt(v.memory);
  }

  // Storage
  const sd = await ovirtGet<any>(cluster, "storagedomains");
  const sds: any[] = Array.isArray(sd?.storage_domain) ? sd.storage_domain : [];
  let storTotalBytes = 0;
  let storAvailBytes = 0;
  for (const s of sds) {
    const used = toInt(s.used);
    const available = toInt(s.available);
    storTotalBytes += used + available;
    storAvailBytes += available;
  }

  return {
    cpuCoresTotal,
    cpuCoresUsed: cpuCoresReserved,
    memoryGBTotal: Math.round(memTotalBytes / GB),
    memoryGBAvailable: Math.max(
      0,
      Math.round((memTotalBytes - memReservedBytes) / GB),
    ),
    storageGBTotal: Math.round(storTotalBytes / GB),
    storageGBAvailable: Math.round(storAvailBytes / GB),
  };
}
