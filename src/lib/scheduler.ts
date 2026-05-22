import cron from "node-cron";
import { getAlertConfig, runAlertSweep } from "./alerts";
import { refreshAllClusters } from "./ovirt";
import { prisma } from "./db";

let alertTask: cron.ScheduledTask | null = null;
let currentAlertExpr: string | null = null;
let clusterTask: cron.ScheduledTask | null = null;
let currentClusterExpr: string | null = null;

async function applyAlertCron() {
  let cfg;
  try {
    cfg = await getAlertConfig();
  } catch (e) {
    console.error("[scheduler] failed to read AlertConfig:", e);
    return;
  }
  const expr = cfg.enabled ? cfg.cronExpression : null;
  if (!expr) {
    if (alertTask) {
      alertTask.stop();
      alertTask = null;
      currentAlertExpr = null;
      console.log("[scheduler] alerts disabled");
    }
    return;
  }
  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid alert cron: ${expr}`);
    return;
  }
  if (currentAlertExpr === expr && alertTask) return;
  if (alertTask) alertTask.stop();
  alertTask = cron.schedule(expr, async () => {
    try {
      console.log("[scheduler] running alert sweep");
      const summary = await runAlertSweep();
      console.log("[scheduler] sweep summary", summary);
    } catch (err) {
      console.error("[scheduler] sweep failed", err);
    }
  });
  currentAlertExpr = expr;
  console.log(`[scheduler] alerts cron "${expr}"`);
}

function applyClusterCron() {
  const expr = process.env.CLUSTER_REFRESH_CRON || "0 * * * *"; // hourly on the hour
  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid CLUSTER_REFRESH_CRON: ${expr}`);
    return;
  }
  if (currentClusterExpr === expr && clusterTask) return;
  if (clusterTask) clusterTask.stop();
  clusterTask = cron.schedule(expr, async () => {
    try {
      console.log("[scheduler] refreshing cluster capacity");
      const r = await refreshAllClusters(prisma);
      console.log("[scheduler] cluster refresh:", r);
    } catch (err) {
      console.error("[scheduler] cluster refresh failed", err);
    }
  });
  currentClusterExpr = expr;
  console.log(`[scheduler] cluster refresh cron "${expr}"`);
}

export async function reloadScheduler() {
  await applyAlertCron();
  applyClusterCron();
}

let started = false;
export function startScheduler() {
  if (started) return;
  if ((process.env.ENABLE_SCHEDULER ?? "true").toLowerCase() !== "true") {
    console.log("[scheduler] disabled via ENABLE_SCHEDULER=false");
    return;
  }
  started = true;
  applyAlertCron().catch((e) => console.error("[scheduler] alert init failed", e));
  applyClusterCron();
  // Re-check alert config every 5 min so admin changes take effect without restart
  setInterval(() => applyAlertCron().catch(() => {}), 5 * 60 * 1000);
  // Kick off an immediate cluster refresh on boot (10s grace for DB)
  setTimeout(() => {
    refreshAllClusters(prisma)
      .then((r) => console.log("[scheduler] startup cluster refresh:", r))
      .catch((e) => console.error("[scheduler] startup refresh failed", e));
  }, 10_000);
}
