import cron from "node-cron";
import { runAlertSweep } from "./alerts";

let started = false;

export function startScheduler() {
  if (started) return;
  if ((process.env.ENABLE_SCHEDULER ?? "true").toLowerCase() !== "true") {
    console.log("[scheduler] disabled via ENABLE_SCHEDULER=false");
    return;
  }
  const expr = process.env.ALERT_CRON || "0 9 * * *";
  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid ALERT_CRON: ${expr}`);
    return;
  }
  cron.schedule(expr, async () => {
    try {
      console.log("[scheduler] running alert sweep");
      const summary = await runAlertSweep();
      console.log("[scheduler] sweep summary", summary);
    } catch (err) {
      console.error("[scheduler] sweep failed", err);
    }
  });
  started = true;
  console.log(`[scheduler] started with cron "${expr}"`);
}
