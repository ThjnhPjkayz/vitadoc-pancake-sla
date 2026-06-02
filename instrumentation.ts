// ============================================================
// Instrumentation — Auto-start cron jobs on server startup
// ============================================================

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncJob, startSLARecalcJob } = await import("@/lib/services/cron");

    const enabled = process.env.CRON_ENABLED === "true";

    if (enabled) {
      const syncInterval = Number(process.env.CRON_INTERVAL_MINUTES) || 10;
      const slaInterval = Number(process.env.SLA_RECALC_INTERVAL_MINUTES) || 5;

      startSyncJob(syncInterval);
      startSLARecalcJob(slaInterval);

      console.log(`[Instrumentation] Sync job: every ${syncInterval} min | SLA recalc job: every ${slaInterval} min`);
    } else {
      console.log("[Instrumentation] Cron disabled (CRON_ENABLED=false)");
    }
  }
}
