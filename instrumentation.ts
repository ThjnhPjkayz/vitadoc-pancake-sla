// ============================================================
// Instrumentation — Auto-start cron jobs on server startup
// ============================================================

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { backfillConversationType } = await import("@/lib/services/dashboard");

    const backfilled = await backfillConversationType();
    if (backfilled > 0) {
      console.log(`[Instrumentation] Backfilled conversationType for ${backfilled} SLAViolation records`);
    }
  }
}
