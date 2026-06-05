// ============================================================
// Cron Jobs
//   Job 1 — Sync full data từ Pancake (23:59 hàng ngày)
// ============================================================

import cron, { type ScheduledTask } from "node-cron";
import { syncAllPages } from "@/lib/services/sync";

let syncJob: ScheduledTask | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 phút giữa mỗi retry

// ----------------------------------------------------------------
// Job 1 — Sync full data từ Pancake API (23:59 daily)
// ----------------------------------------------------------------

export function startSyncJob(): void {
  if (syncJob) {
    console.warn("[Cron/Sync] Already running, skipping...");
    return;
  }

  // Chạy lúc 23:59 giờ Việt Nam (UTC+7 → 16:59 UTC)
  const cronExpression = "59 16 * * *";

  syncJob = cron.schedule(cronExpression, async () => {
    console.log(`[Cron/Sync] ⏰ Triggered at ${new Date().toISOString()}`);
    await runSyncWithRetry();
  });

  console.log(`[Cron/Sync] 🕐 Scheduled at 23:59 VN time daily (${cronExpression})`);
}

export function stopSyncJob(): void {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    console.log("[Cron/Sync] ⏹ Stopped");
  }
}

// ----------------------------------------------------------------
// Retry wrapper — thử lại tối đa MAX_RETRIES lần nếu fail
// ----------------------------------------------------------------

async function runSyncWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stats = await syncAllPages();
      console.log(`[Cron/Sync] ✅ Done (attempt ${attempt})`, {
        conversations: stats.conversations.upserted,
        messages: stats.messages.upserted,
        errors: stats.errors.length,
      });
      return;
    } catch (err) {
      console.error(`[Cron/Sync] ❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, err);

      if (attempt < MAX_RETRIES) {
        console.log(`[Cron/Sync] 🔄 Retrying in ${RETRY_DELAY_MS / 60000} min...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error("[Cron/Sync] ❌ All retries exhausted. Giving up for today.");
      }
    }
  }
}

// ----------------------------------------------------------------
// Compat — giữ lại để không breaking change nếu có import cũ
// ----------------------------------------------------------------

export const startCronJob = startSyncJob;
export const stopCronJob = stopSyncJob;

// ----------------------------------------------------------------
// Run once — dùng để test thủ công
// ----------------------------------------------------------------

export async function runOnce(): Promise<void> {
  console.log("[Cron] 🔄 Manual run...");
  await runSyncWithRetry();
}
