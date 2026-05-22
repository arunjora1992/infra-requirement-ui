import cron from "node-cron";
import { getAlertConfig, runAlertSweep } from "./alerts";

let task: cron.ScheduledTask | null = null;
let currentExpr: string | null = null;

async function applyConfig() {
  let cfg;
  try {
    cfg = await getAlertConfig();
  } catch (e) {
    console.error("[scheduler] failed to read AlertConfig:", e);
    return;
  }
  const expr = (cfg.enabled ? cfg.cronExpression : null) || null;
  if (!expr) {
    if (task) {
      task.stop();
      task = null;
      currentExpr = null;
      console.log("[scheduler] disabled");
    }
    return;
  }
  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid cron expression in AlertConfig: ${expr}`);
    return;
  }
  if (currentExpr === expr && task) return;
  if (task) task.stop();
  task = cron.schedule(expr, async () => {
    try {
      console.log("[scheduler] running alert sweep");
      const summary = await runAlertSweep();
      console.log("[scheduler] sweep summary", summary);
    } catch (err) {
      console.error("[scheduler] sweep failed", err);
    }
  });
  currentExpr = expr;
  console.log(`[scheduler] started with cron "${expr}"`);
}

export async function reloadScheduler() {
  await applyConfig();
}

let started = false;
export function startScheduler() {
  if (started) return;
  if ((process.env.ENABLE_SCHEDULER ?? "true").toLowerCase() !== "true") {
    console.log("[scheduler] disabled via ENABLE_SCHEDULER=false");
    return;
  }
  started = true;
  applyConfig().catch((e) => console.error("[scheduler] initial load failed", e));
  // Re-check config every 5 minutes so admin changes pick up without restart
  setInterval(() => applyConfig().catch(() => {}), 5 * 60 * 1000);
}
