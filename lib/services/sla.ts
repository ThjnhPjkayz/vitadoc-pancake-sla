// ============================================================
// SLA Calculation Engine
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  getSLAConfig,
  getThresholdByType,
  calculateWorkingMinutes,
  isOutsideBusinessHours,
  DEFAULT_SLA_CONFIG,
} from "@/lib/services/sla-config";

export interface SLAResult {
  conversationId: string;
  pageId: string;
  conversationType: string;
  customerMessageId: string | null;
  customerMessageAt: Date | null;
  adminReplyMessageId: string | null;
  adminReplyAt: Date | null;
  responseTimeMinutes: number | null;
  effectiveResponseMinutes: number | null;
  outsideBusinessHours: boolean;
  isLateReply: boolean;
}

// ----------------------------------------------------------------
// Main: Tính SLA cho 1 conversation
// ----------------------------------------------------------------

export async function calculateSLAForConversation(
  conversationId: string,
  pageId: string
): Promise<SLAResult> {
  const config = await getSLAConfig();

  const [conversation, page] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    }),
    prisma.page.findUnique({
      where: { id: pageId },
      select: { timezone: true },
    }),
  ]);

  const convType = conversation?.type ?? "INBOX";
  const timezone = page?.timezone ?? 7;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { insertedAt: "asc" },
    select: {
      id: true,
      isFromCustomer: true,
      isFromAdmin: true,
      insertedAt: true,
    },
  });

  const firstCustomerMsg = messages.find((m) => m.isFromCustomer);

  if (!firstCustomerMsg?.insertedAt) {
    const hasAdminMessages = messages.some((m) => m.isFromAdmin);
    return saveAndReturn({
      conversationId,
      pageId,
      convType,
      threshold: getThresholdByType(convType, false, config),
      customerMessageId: null,
      customerMessageAt: null,
      adminReplyMessageId: null,
      adminReplyAt: null,
      responseTimeMinutes: null,
      effectiveResponseMinutes: null,
      outsideBusinessHours: false,
      isLateReply: false,
      slaStatus: hasAdminMessages ? "outbound" : "pending",
    });
  }

  const outsideBH = isOutsideBusinessHours(
    firstCustomerMsg.insertedAt,
    timezone,
    config.businessHours
  );

  const threshold = getThresholdByType(convType, outsideBH, config);

  const firstAdminReply = messages.find(
    (m) =>
      m.isFromAdmin &&
      m.insertedAt &&
      m.insertedAt > firstCustomerMsg.insertedAt!
  );

  if (!firstAdminReply?.insertedAt) {
    return saveAndReturn({
      conversationId,
      pageId,
      convType,
      threshold,
      customerMessageId: firstCustomerMsg.id,
      customerMessageAt: firstCustomerMsg.insertedAt,
      adminReplyMessageId: null,
      adminReplyAt: null,
      responseTimeMinutes: null,
      effectiveResponseMinutes: null,
      outsideBusinessHours: outsideBH,
      isLateReply: false,
      slaStatus: "pending",
    });
  }

  const responseTimeMs =
    firstAdminReply.insertedAt.getTime() -
    firstCustomerMsg.insertedAt.getTime();
  const responseTimeMinutes = Math.round(responseTimeMs / 60_000);

  const effectiveResponseMinutes = calculateWorkingMinutes(
    firstCustomerMsg.insertedAt,
    firstAdminReply.insertedAt,
    timezone,
    config.businessHours
  );

  const isLateReply = effectiveResponseMinutes > threshold;
  const slaStatus = isLateReply ? "late" : "on-time";

  return saveAndReturn({
    conversationId,
    pageId,
    convType,
    threshold,
    customerMessageId: firstCustomerMsg.id,
    customerMessageAt: firstCustomerMsg.insertedAt,
    adminReplyMessageId: firstAdminReply.id,
    adminReplyAt: firstAdminReply.insertedAt,
    responseTimeMinutes,
    effectiveResponseMinutes,
    outsideBusinessHours: outsideBH,
    isLateReply,
    slaStatus,
  });
}

// ----------------------------------------------------------------
// Helper: upsert SLAViolation + return result
// ----------------------------------------------------------------

async function saveAndReturn(params: {
  conversationId: string;
  pageId: string;
  convType: string;
  threshold: number;
  customerMessageId: string | null;
  customerMessageAt: Date | null;
  adminReplyMessageId: string | null;
  adminReplyAt: Date | null;
  responseTimeMinutes: number | null;
  effectiveResponseMinutes: number | null;
  outsideBusinessHours: boolean;
  isLateReply: boolean;
  slaStatus: string;
}): Promise<SLAResult> {
  const {
    conversationId,
    pageId,
    convType,
    threshold,
    customerMessageId,
    customerMessageAt,
    adminReplyMessageId,
    adminReplyAt,
    responseTimeMinutes,
    effectiveResponseMinutes,
    outsideBusinessHours,
    isLateReply,
    slaStatus,
  } = params;

  const slaId = `${conversationId}_sla`;
  const shared = {
    conversationType: convType,
    customerMessageId: customerMessageId ?? "",
    customerMessageAt: customerMessageAt ?? new Date(0),
    adminReplyMessageId,
    adminReplyAt,
    responseTimeMinutes,
    effectiveResponseMinutes,
    outsideBusinessHours,
    isLateReply,
    slaStatus,
    slaThresholdMinutes: threshold,
  };

  await prisma.sLAViolation.upsert({
    where: { id: slaId },
    update: shared,
    create: { id: slaId, conversationId, pageId, ...shared },
  });

  return {
    conversationId,
    pageId,
    conversationType: convType,
    customerMessageId,
    customerMessageAt,
    adminReplyMessageId,
    adminReplyAt,
    responseTimeMinutes,
    effectiveResponseMinutes,
    outsideBusinessHours,
    isLateReply,
  };
}

// ----------------------------------------------------------------
// Recalculate pending SLAs
// ----------------------------------------------------------------

export async function recalculatePendingSLAs(): Promise<number> {
  const config = await getSLAConfig();

  const pending = await prisma.sLAViolation.findMany({
    where: {
      slaStatus: "pending",
      customerMessageId: { not: "" },
    },
    select: {
      id: true,
      customerMessageAt: true,
      slaThresholdMinutes: true,
      pageId: true,
      conversationType: true,
    },
  });

  if (pending.length === 0) return 0;

  const pageIds = [...new Set(pending.map((p) => p.pageId))];
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, timezone: true },
  });
  const timezoneMap = new Map(pages.map((p) => [p.id, p.timezone ?? 7]));

  const now = new Date();
  let updatedCount = 0;

  for (const violation of pending) {
    if (violation.customerMessageAt.getTime() === 0) continue;

    const timezone = timezoneMap.get(violation.pageId) ?? 7;
    const effectiveMinutes = calculateWorkingMinutes(
      violation.customerMessageAt,
      now,
      timezone,
      config.businessHours
    );

    if (effectiveMinutes > violation.slaThresholdMinutes) {
      await prisma.sLAViolation.update({
        where: { id: violation.id },
        data: {
          slaStatus: "late",
          isLateReply: true,
          effectiveResponseMinutes: effectiveMinutes,
          conversationType: violation.conversationType ?? undefined,
        },
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

// ----------------------------------------------------------------
// Batch: Tính SLA cho tất cả conversations của 1 page
// ----------------------------------------------------------------

export async function calculateSLAForPage(
  pageId: string
): Promise<SLAResult[]> {
  const conversations = await prisma.conversation.findMany({
    where: { pageId },
    select: { id: true },
  });

  return Promise.all(
    conversations.map((c) => calculateSLAForConversation(c.id, pageId))
  );
}

// ----------------------------------------------------------------
// Summary
// ----------------------------------------------------------------

export async function getSLASummary() {
  const [total, violations, byPage] = await Promise.all([
    prisma.sLAViolation.count(),
    prisma.sLAViolation.count({ where: { isLateReply: true } }),
    prisma.sLAViolation.groupBy({
      by: ["pageId"],
      where: { isLateReply: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  const avgResponseTime = await prisma.sLAViolation.aggregate({
    _avg: { effectiveResponseMinutes: true },
    where: { effectiveResponseMinutes: { not: null } },
  });

  return {
    totalConversations: total,
    totalViolations: violations,
    violationRate: total > 0 ? ((violations / total) * 100).toFixed(1) : "0",
    avgResponseTimeMinutes: Math.round(
      avgResponseTime._avg.effectiveResponseMinutes ?? 0
    ),
    violationsByPage: byPage.map((p) => ({
      pageId: p.pageId,
      count: p._count.id,
    })),
  };
}
