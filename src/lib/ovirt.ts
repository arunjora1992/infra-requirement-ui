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
    throw new Error(`oVirt ${res.status} ${res.statusText} – ${body.slice(0, 240)}`);
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

export async function testConnection(cluster: OvirtCluster): Promise<{ ok: true; product?: string }> {
  const r = await ovirtGet<any>(cluster, "");
  return { ok: true, product: r?.product_info?.name ?? "oVirt" };
}

export async function fetchCapacity(cluster: OvirtCluster): Promise<OvirtCapacity> {
  // Hosts give us CPU cores + memory totals; statistics give used cpu/memory.
  // /hosts?follow=statistics returns the statistics inline.
  const hosts = await ovirtGet<any>(cluster, "hosts?follow=statistics");
  const hostList: any[] = Array.isArray(hosts?.host) ? hosts.host : [];

  let cpuCoresTotal = 0;
  let cpuCoresUsedFraction = 0; // sum of (cores * usagePercent/100)
  let memTotalBytes = 0;
  let memUsedBytes = 0;

  for (const h of hostList) {
    if (h.status && h.status !== "up") continue;
    const cores =
      toInt(h.cpu?.topology?.cores) *
      toInt(h.cpu?.topology?.sockets) *
      Math.max(1, toInt(h.cpu?.topology?.threads));
    cpuCoresTotal += cores;
    memTotalBytes += toInt(h.memory);

    // statistics: array of { name, values: { value: [{ datum }] } }
    const stats: any[] = Array.isArray(h.statistics?.statistic)
      ? h.statistics.statistic
      : [];
    const statVal = (n: string) =>
      toInt(stats.find((s) => s.name === n)?.values?.value?.[0]?.datum);
    const cpuPct = statVal("cpu.current.user") + statVal("cpu.current.system");
    cpuCoresUsedFraction += (cpuPct / 100) * cores;
    const memUsed = statVal("memory.used");
    if (memUsed > 0) memUsedBytes += memUsed;
  }

  // Storage
  const sd = await ovirtGet<any>(cluster, "storagedomains");
  const sds: any[] = Array.isArray(sd?.storage_domain) ? sd.storage_domain : [];
  let storTotalBytes = 0;
  let storAvailBytes = 0;
  for (const s of sds) {
    const used = toInt(s.used);
    const available = toInt(s.available);
    // 'committed' is reserved-by-VMs; we don't subtract from available here.
    storTotalBytes += used + available;
    storAvailBytes += available;
  }

  return {
    cpuCoresTotal,
    cpuCoresUsed: Math.round(cpuCoresUsedFraction),
    memoryGBTotal: Math.round(memTotalBytes / GB),
    memoryGBAvailable: Math.max(
      0,
      Math.round((memTotalBytes - memUsedBytes) / GB),
    ),
    storageGBTotal: Math.round(storTotalBytes / GB),
    storageGBAvailable: Math.round(storAvailBytes / GB),
  };
}
