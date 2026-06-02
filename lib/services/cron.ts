// ============================================================
// Cron Jobs
//   Job 1 — Sync data từ Pancake (mỗi 10 phút)
//   Job 2 — Recalculate pending SLAs từ DB (mỗi 5 phút)
// ============================================================

import cron from "node-cron";
import { syncAllPages } from "@/lib/services/sync";
import { recalculatePendingSLAs } from "@/lib/services/sla";
import { prisma } from "@/lib/prisma";

let syncJob: cron.ScheduledTask | null = null;
let slaRecalcJob: cron.ScheduledTask | null = null;

// ----------------------------------------------------------------
// Job 1 — Sync data từ Pancake API
// ----------------------------------------------------------------

export function startSyncJob(intervalMinutes = 10): void {
  if (syncJob) {
    console.warn("[Cron/Sync] Already running, skipping...");
    return;
  }

  const cronExpression = `*/${intervalMinutes} * * * *`;

  syncJob = cron.schedule(cronExpression, async () => {
    console.log(`[Cron/Sync] ⏰ Triggered at ${new Date().toISOString()}`);

    try {
      const lastSync = await prisma.syncHistory.findFirst({
        where: { status: "success" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });

      // Dùng startedAt - 2 phút buffer để không bỏ sót conv update trong lúc sync đang chạy
      const since = lastSync?.startedAt
        ? new Date(lastSync.startedAt.getTime() - 2 * 60 * 1000)
        : undefined;

      const stats = await syncAllPages(since);
      console.log("[Cron/Sync] ✅ Done", {
        conversations: stats.conversations.upserted,
        skipped: stats.conversations.skipped,
        messages: stats.messages.upserted,
        errors: stats.errors.length,
      });
    } catch (err) {
      console.error("[Cron/Sync] ❌ Failed:", err);
    }
  });

  console.log(`[Cron/Sync] 🕐 Scheduled every ${intervalMinutes} min (${cronExpression})`);
}

export function stopSyncJob(): void {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    console.log("[Cron/Sync] ⏹ Stopped");
  }
}

// ----------------------------------------------------------------
// Job 2 — Recalculate pending SLAs từ DB (không gọi API)
// ----------------------------------------------------------------

export function startSLARecalcJob(intervalMinutes = 5): void {
  if (slaRecalcJob) {
    console.warn("[Cron/SLA] Already running, skipping...");
    return;
  }

  const cronExpression = `*/${intervalMinutes} * * * *`;

  slaRecalcJob = cron.schedule(cronExpression, async () => {
    try {
      const updated = await recalculatePendingSLAs();
      if (updated > 0) {
        console.log(`[Cron/SLA] ✅ Marked ${updated} conversation(s) as late`);
      }
    } catch (err) {
      console.error("[Cron/SLA] ❌ Failed:", err);
    }
  });

  console.log(`[Cron/SLA] 🕐 Scheduled every ${intervalMinutes} min (${cronExpression})`);
}

export function stopSLARecalcJob(): void {
  if (slaRecalcJob) {
    slaRecalcJob.stop();
    slaRecalcJob = null;
    console.log("[Cron/SLA] ⏹ Stopped");
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
  try {
    const stats = await syncAllPages();
    console.log("[Cron] ✅ Manual sync done", stats);
  } catch (err) {
    console.error("[Cron] ❌ Manual sync failed:", err);
  }
}
