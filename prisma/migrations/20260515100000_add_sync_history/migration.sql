CREATE TABLE IF NOT EXISTS "SyncHistory" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "pagesCount" INTEGER NOT NULL DEFAULT 0,
    "conversationsCount" INTEGER NOT NULL DEFAULT 0,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "slaChecked" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyncHistory_status_idx" ON "SyncHistory"("status");
CREATE INDEX IF NOT EXISTS "SyncHistory_startedAt_idx" ON "SyncHistory"("startedAt");
