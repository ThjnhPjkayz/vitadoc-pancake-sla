// Sync progress — in-memory within one function execution, flushed to DB for cross-request reads

import { prisma } from "@/lib/prisma";

export interface SyncProgress {
  isRunning: boolean;
  currentPage: string | null;
  currentPageName: string | null;
  currentPageIndex: number;
  totalPages: number;
  conversations: number;
  messages: number;
  slaChecked: number;
  errors: number;
  startedAt: string | null;
}

const initial: SyncProgress = {
  isRunning: false,
  currentPage: null,
  currentPageName: null,
  currentPageIndex: 0,
  totalPages: 0,
  conversations: 0,
  messages: 0,
  slaChecked: 0,
  errors: 0,
  startedAt: null,
};

let _progress: SyncProgress = { ...initial };

export function getSyncProgress(): SyncProgress {
  return { ..._progress };
}

export function startProgress(totalPages: number): void {
  _progress = {
    ...initial,
    isRunning: true,
    totalPages,
    startedAt: new Date().toISOString(),
  };
}

export function updatePageProgress(
  pageIndex: number,
  pageId: string,
  pageName: string
): void {
  _progress.currentPageIndex = pageIndex;
  _progress.currentPage = pageId;
  _progress.currentPageName = pageName;
}

export function updateCounts(delta: {
  conversations?: number;
  messages?: number;
  slaChecked?: number;
  errors?: number;
}): void {
  if (delta.conversations) _progress.conversations += delta.conversations;
  if (delta.messages) _progress.messages += delta.messages;
  if (delta.slaChecked) _progress.slaChecked += delta.slaChecked;
  if (delta.errors) _progress.errors += delta.errors;
}

export function endProgress(): void {
  _progress.isRunning = false;
  _progress.currentPage = null;
  _progress.currentPageName = null;
}

// Flush in-memory progress to DB so other serverless instances can read it
export async function flushToDB(syncHistoryId: string): Promise<void> {
  try {
    await prisma.syncHistory.update({
      where: { id: syncHistoryId },
      data: { progressSnapshot: _progress as unknown as Record<string, unknown> },
    });
  } catch {
    // Non-critical — don't fail sync if flush fails
  }
}
