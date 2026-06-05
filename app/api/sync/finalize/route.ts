// POST /api/sync/finalize — Marks a SyncHistory record as complete.

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as {
    syncId: string;
    pagesCount?: number;
    conversationsCount?: number;
    messagesCount?: number;
    slaChecked?: number;
    errors?: string[];
    cancelled?: boolean;
  };

  const { syncId, pagesCount, conversationsCount, messagesCount, slaChecked, errors, cancelled } = body;

  const status = cancelled ? "cancelled" : (errors?.length ?? 0) > 0 ? "failed" : "success";

  try {
    await prisma.syncHistory.update({
      where: { id: syncId },
      data: {
        status,
        completedAt: new Date(),
        pagesCount: pagesCount ?? 0,
        conversationsCount: conversationsCount ?? 0,
        messagesCount: messagesCount ?? 0,
        slaChecked: slaChecked ?? 0,
        errors: (errors?.length ?? 0) > 0 ? errors : undefined,
        progressSnapshot: { isRunning: false },
      },
    });
    return Response.json({ success: true, status });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
