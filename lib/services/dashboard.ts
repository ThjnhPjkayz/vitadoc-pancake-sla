// ============================================================
// Dashboard Service — Prisma queries optimized cho dashboard
// ============================================================

import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------
// Backfill conversationType from Conversation.type for null records
// ----------------------------------------------------------------

export async function backfillConversationType(): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "SLAViolation" s
    SET "conversationType" = c.type
    FROM "Conversation" c
    WHERE s."conversationId" = c.id
      AND s."conversationType" IS NULL
  `;
  return result;
}
import { Prisma } from "@/app/generated/prisma";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface DashboardStats {
  totalPages: number;
  totalConversations: number;
  totalMessages: number;
  totalSLAViolations: number;
  avgResponseTimeMinutes: number;
  slaSuccessRate: number;
  lateReplyCount: number;
  inHoursViolations: number;
  afterHoursViolations: number;
  onTimeCount: number;
  pendingCount: number;
  pendingBreachedCount: number;
  pagesAtLimit: number;
}

export interface ConversationFilter {
  search?: string;
  pageId?: string;
  platform?: string;
  conversationType?: "INBOX" | "COMMENT";
  slaStatus?: "on-time" | "late" | "no-reply" | "needs-attention" | "outbound";
  hoursFilter?: "in-hours" | "after-hours";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "customerMessageAt" | "responseTimeMinutes" | "customerName";
  sortOrder?: "asc" | "desc";
}

export interface ConversationRow {
  id: string;
  customerName: string | null;
  customerUsername: string | null;
  pageName: string;
  platform: string;
  pageId: string;
  lastMessage: string | null;
  responseTimeMinutes: number | null;
  isLateReply: boolean;
  hasReply: boolean;
  isOutbound: boolean;
  customerMessageAt: string | null;
  adminReplyAt: string | null;
  conversationType: string;
  outsideBusinessHours: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SLAChartData {
  date: string;
  total: number;
  violations: number;
  avgResponseTime: number;
}

export interface PageFilter {
  id: string;
  name: string;
  platform: string;
}

export interface PageSummary {
  pageId: string;
  pageName: string;
  platform: string;
  total: number;
  lateCount: number;
  pendingCount: number;         // all unreplied (used for onTimeCount)
  pendingBreachedCount: number; // unreplied AND past SLA threshold
  onTimeCount: number;
  avgResponseTimeMinutes: number;
  avgInboxResponseTimeMinutes: number;
  avgCommentResponseTimeMinutes: number;
  lateRate: number; // 0–1, computed over resolved conversations only
}

// ----------------------------------------------------------------
// Get Dashboard Stats
// ----------------------------------------------------------------

export async function getDashboardStats(
  pageId?: string
): Promise<DashboardStats> {
  const wherePage = pageId ? { pageId } : {};

  const [
    totalPages,
    totalConversations,
    totalMessages,
    slaAgg,
    slaGrouped,
    pendingCount,
    inHoursViolations,
    afterHoursViolations,
    pendingBreachedCount,
  ] = await Promise.all([
    prisma.page.count({ where: { isActivated: true } }),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.sLAViolation.aggregate({
      where: { responseTimeMinutes: { not: null }, ...wherePage },
      _avg: { responseTimeMinutes: true },
      _count: { id: true },
    }),
    prisma.sLAViolation.groupBy({
      by: ["isLateReply"],
      where: { responseTimeMinutes: { not: null }, ...wherePage },
      _count: { id: true },
    }),
    prisma.sLAViolation.count({
      where: { responseTimeMinutes: null, slaStatus: { not: "outbound" }, ...wherePage },
    }),
    prisma.sLAViolation.count({
      where: { isLateReply: true, outsideBusinessHours: false, ...wherePage },
    }),
    prisma.sLAViolation.count({
      where: { isLateReply: true, outsideBusinessHours: true, ...wherePage },
    }),
    prisma.sLAViolation.count({
      where: {
        responseTimeMinutes: null,
        slaStatus: { not: "outbound" },
        ...wherePage,
        OR: [
          {
            conversationType: "INBOX",
            customerMessageAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
          },
          {
            conversationType: "COMMENT",
            customerMessageAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
          },
        ],
      },
    }),
  ]);

  const pagesAtLimit = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM (SELECT "pageId", COUNT(*) as cnt FROM "Conversation" GROUP BY "pageId" HAVING COUNT(*) = 60) sub`
  ).then((r) => Number(r[0].count));

  const totalSLA = slaAgg._count.id;
  const lateReply = slaGrouped.find((g) => g.isLateReply)?._count.id ?? 0;
  const onTime = slaGrouped.find((g) => !g.isLateReply)?._count.id ?? 0;

  return {
    totalPages,
    totalConversations,
    totalMessages,
    totalSLAViolations: totalSLA,
    avgResponseTimeMinutes: Math.round(slaAgg._avg.responseTimeMinutes ?? 0),
    slaSuccessRate: totalSLA > 0 ? onTime / totalSLA : 0,
    lateReplyCount: lateReply,
    inHoursViolations,
    afterHoursViolations,
    onTimeCount: onTime,
    pendingCount,
    pendingBreachedCount,
    pagesAtLimit,
  };
}

// ----------------------------------------------------------------
// Get Page Summaries (leaderboard)
// ----------------------------------------------------------------

export async function getPageSummaries(dateFrom?: Date): Promise<PageSummary[]> {
  const dateFilter = dateFrom
    ? Prisma.sql`AND s."customerMessageAt" >= ${dateFrom}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<
    Array<{
      pageId: string;
      pageName: string;
      platform: string;
      total: bigint;
      lateCount: bigint;
      pendingCount: bigint;
      pendingBreachedCount: bigint;
      avgResponseTimeMinutes: number | null;
      avgInboxResponseTimeMinutes: number | null;
      avgCommentResponseTimeMinutes: number | null;
    }>
  >(Prisma.sql`
    SELECT
      p.id                                                           AS "pageId",
      p.name                                                         AS "pageName",
      p.platform,
      COUNT(CASE WHEN s."slaStatus" != 'outbound' THEN 1 END)       AS total,
      SUM(CASE WHEN s."isLateReply" = true THEN 1 ELSE 0 END)       AS "lateCount",
      COUNT(CASE WHEN s."responseTimeMinutes" IS NULL
                      AND s."slaStatus" != 'outbound'
                 THEN 1 END)                                         AS "pendingCount",
      COUNT(CASE WHEN s."responseTimeMinutes" IS NULL
                      AND s."slaStatus" != 'outbound'
                      AND (
                        (s."conversationType" = 'INBOX'   AND s."customerMessageAt" < NOW() - INTERVAL '15 minutes')
                        OR
                        (s."conversationType" = 'COMMENT' AND s."customerMessageAt" < NOW() - INTERVAL '60 minutes')
                      )
                 THEN 1 END)                                         AS "pendingBreachedCount",
      ROUND(AVG(CASE WHEN s."responseTimeMinutes" IS NOT NULL THEN s."responseTimeMinutes" END))                                                          AS "avgResponseTimeMinutes",
      ROUND(AVG(CASE WHEN s."responseTimeMinutes" IS NOT NULL AND s."conversationType" = 'INBOX'   THEN s."responseTimeMinutes" END))                     AS "avgInboxResponseTimeMinutes",
      ROUND(AVG(CASE WHEN s."responseTimeMinutes" IS NOT NULL AND s."conversationType" = 'COMMENT' THEN s."responseTimeMinutes" END))                     AS "avgCommentResponseTimeMinutes"
    FROM "Page" p
    LEFT JOIN "SLAViolation" s ON s."pageId" = p.id ${dateFilter}
    WHERE p."isActivated" = true
    GROUP BY p.id, p.name, p.platform
  `);

  return rows
    .map((r) => {
      const total = Number(r.total);
      const lateCount = Number(r.lateCount);
      const pendingCount = Number(r.pendingCount);
      const pendingBreachedCount = Number(r.pendingBreachedCount);
      const resolvedCount = total - pendingCount;
      const onTimeCount = Math.max(0, total - lateCount - pendingCount);
      return {
        pageId: r.pageId,
        pageName: r.pageName,
        platform: r.platform,
        total,
        lateCount,
        pendingCount,
        pendingBreachedCount,
        onTimeCount,
        avgResponseTimeMinutes: r.avgResponseTimeMinutes ? Math.round(r.avgResponseTimeMinutes) : 0,
        avgInboxResponseTimeMinutes: r.avgInboxResponseTimeMinutes ? Math.round(r.avgInboxResponseTimeMinutes) : 0,
        avgCommentResponseTimeMinutes: r.avgCommentResponseTimeMinutes ? Math.round(r.avgCommentResponseTimeMinutes) : 0,
        lateRate: resolvedCount > 0 ? lateCount / resolvedCount : 0,
      };
    })
    .sort((a, b) => b.lateRate - a.lateRate);
}

// ----------------------------------------------------------------
// Get Conversations (filtered, paginated, sorted)
// ----------------------------------------------------------------

export async function getConversations(
  filter: ConversationFilter
): Promise<PaginatedResult<ConversationRow>> {
  const {
    search,
    pageId,
    platform,
    conversationType,
    slaStatus,
    hoursFilter,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
    sortBy = "customerMessageAt",
    sortOrder = "desc",
  } = filter;

  const slaWhere: Record<string, unknown> = {};

  if (conversationType) slaWhere.conversationType = conversationType;

  if (slaStatus === "on-time") {
    slaWhere.isLateReply = false;
    slaWhere.responseTimeMinutes = { not: null };
  } else if (slaStatus === "late") {
    slaWhere.isLateReply = true;
  } else if (slaStatus === "no-reply") {
    slaWhere.responseTimeMinutes = null;
    slaWhere.slaStatus = { not: "outbound" };
  } else if (slaStatus === "needs-attention") {
    slaWhere.OR = [
      { isLateReply: true },
      { responseTimeMinutes: null, slaStatus: { not: "outbound" } },
    ];
  } else if (slaStatus === "outbound") {
    slaWhere.slaStatus = "outbound";
  }

  if (hoursFilter === "in-hours") {
    slaWhere.outsideBusinessHours = false;
  } else if (hoursFilter === "after-hours") {
    slaWhere.outsideBusinessHours = true;
  }

  if (dateFrom || dateTo) {
    slaWhere.customerMessageAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(new Date(dateTo).getTime() + 86_400_000 - 1) } : {}),
    };
  }

  const pageWhere: Record<string, unknown> = {};
  if (platform) pageWhere.platform = platform;
  if (search) pageWhere.name = { contains: search, mode: "insensitive" };

  const where: Record<string, unknown> = {};
  if (pageId) where.pageId = pageId;
  if (Object.keys(pageWhere).length > 0) where.page = pageWhere;

  const [data, total] = await Promise.all([
    prisma.sLAViolation.findMany({
      where: { ...where, ...slaWhere },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            snippet: true,
            customerName: true,
            customerUsername: true,
          },
        },
        page: {
          select: { name: true, platform: true, id: true },
        },
      },
      orderBy:
        sortBy === "customerName"
          ? { conversation: { customerName: sortOrder } }
          : { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sLAViolation.count({ where: { ...where, ...slaWhere } }),
  ]);

  return {
    data: data.map((row) => ({
      id: row.conversationId,
      customerName: row.conversation.customerName,
      customerUsername: row.conversation.customerUsername,
      pageName: row.page.name,
      platform: row.page.platform,
      pageId: row.pageId,
      lastMessage: row.conversation.snippet,
      responseTimeMinutes: row.responseTimeMinutes,
      isLateReply: row.isLateReply,
      hasReply: row.responseTimeMinutes !== null,
      isOutbound: row.slaStatus === "outbound",
      customerMessageAt: row.customerMessageAt?.toISOString() ?? null,
      adminReplyAt: row.adminReplyAt?.toISOString() ?? null,
      conversationType: row.conversation.type,
      outsideBusinessHours: row.outsideBusinessHours,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ----------------------------------------------------------------
// Get stats by conversation type (Inbox / Comment)
// ----------------------------------------------------------------

export interface ConversationTypeStats {
  lateWorkingHours: number;
  totalWorkingHours: number;
  lateAfterHours: number;
  totalAfterHours: number;
  pending: number;
  total: number;
}

export async function getConversationTypeStats(
  conversationType: "INBOX" | "COMMENT",
  pageId?: string,
  platform?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<ConversationTypeStats> {
  const where = {
    conversationType,
    ...(pageId ? { pageId } : {}),
    ...(platform ? { page: { platform } } : {}),
    ...(dateFrom || dateTo
      ? {
          customerMessageAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
          },
        }
      : {}),
  };

  const [lateWorkingHours, totalWorkingHours, lateAfterHours, totalAfterHours, pending, total] = await Promise.all([
    prisma.sLAViolation.count({
      where: { ...where, isLateReply: true, outsideBusinessHours: false },
    }),
    prisma.sLAViolation.count({
      where: { ...where, outsideBusinessHours: false, slaStatus: { not: "outbound" } },
    }),
    prisma.sLAViolation.count({
      where: { ...where, isLateReply: true, outsideBusinessHours: true },
    }),
    prisma.sLAViolation.count({
      where: { ...where, outsideBusinessHours: true, slaStatus: { not: "outbound" } },
    }),
    prisma.sLAViolation.count({
      where: { ...where, responseTimeMinutes: null, slaStatus: { not: "outbound" } },
    }),
    prisma.sLAViolation.count({
      where: { ...where, slaStatus: { not: "outbound" } },
    }),
  ]);

  return { lateWorkingHours, totalWorkingHours, lateAfterHours, totalAfterHours, pending, total };
}

// ----------------------------------------------------------------
// Get filter options
// ----------------------------------------------------------------

export async function getFilterOptions(): Promise<{
  pages: PageFilter[];
  platforms: string[];
}> {
  const [pages, platforms] = await Promise.all([
    prisma.page.findMany({
      where: { isActivated: true },
      select: { id: true, name: true, platform: true },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: { isActivated: true },
      distinct: ["platform"],
      select: { platform: true },
    }),
  ]);

  return {
    pages,
    platforms: platforms.map((p) => p.platform),
  };
}

// ----------------------------------------------------------------
// Get SLA chart data (last 30 days)
// ----------------------------------------------------------------

export async function getSLAChartData(
  pageId?: string
): Promise<SLAChartData[]> {
  const wherePage = pageId ? { pageId } : {};

  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const violations = await prisma.sLAViolation.findMany({
    where: { ...wherePage, customerMessageAt: { gte: since } },
    select: {
      customerMessageAt: true,
      isLateReply: true,
      responseTimeMinutes: true,
    },
    orderBy: { customerMessageAt: "asc" },
  });

  const grouped: Record<
    string,
    { total: number; violations: number; totalTime: number }
  > = {};

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    grouped[key] = { total: 0, violations: 0, totalTime: 0 };
  }

  for (const v of violations) {
    if (!v.customerMessageAt) continue;
    const key = v.customerMessageAt.toISOString().slice(0, 10);
    if (!grouped[key]) grouped[key] = { total: 0, violations: 0, totalTime: 0 };
    grouped[key].total++;
    if (v.isLateReply) grouped[key].violations++;
    if (v.responseTimeMinutes) grouped[key].totalTime += v.responseTimeMinutes;
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      total: val.total,
      violations: val.violations,
      avgResponseTime:
        val.total > 0 ? Math.round(val.totalTime / val.total) : 0,
    }));
}

// ----------------------------------------------------------------
// Get SLA Violations Trend (last 7 days, split by conversationType)
// ----------------------------------------------------------------

export interface ViolationsTrendDay {
  date: string; // "DD/MM"
  late: number;
  onTime: number;
}

export async function getViolationsTrend(
  days = 30,
  pageId?: string
): Promise<ViolationsTrendDay[]> {
  const wherePage = pageId ? { pageId } : {};

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...wherePage,
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: since },
    },
    select: { customerMessageAt: true, isLateReply: true },
  });

  const grouped: Record<string, { late: number; onTime: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    grouped[key] = { late: 0, onTime: 0 };
  }

  for (const r of records) {
    if (!r.customerMessageAt) continue;
    const key = r.customerMessageAt.toISOString().slice(0, 10);
    if (!grouped[key]) continue;
    if (r.isLateReply) grouped[key].late++;
    else grouped[key].onTime++;
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => {
      const [, mm, dd] = date.split("-");
      return { date: `${dd}/${mm}`, late: val.late, onTime: val.onTime };
    });
}

// ----------------------------------------------------------------
// Response Time Trend
// ----------------------------------------------------------------

export interface ResponseTimeTrendDay {
  date: string; // "DD/MM"
  inbox: number | null;
  comment: number | null;
}

export async function getResponseTimeTrend(
  days = 30,
  pageId?: string
): Promise<ResponseTimeTrendDay[]> {
  const wherePage = pageId ? { pageId } : {};

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...wherePage,
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: since },
    },
    select: { customerMessageAt: true, conversationType: true, responseTimeMinutes: true },
  });

  const grouped: Record<string, { inboxSum: number; inboxCount: number; commentSum: number; commentCount: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    grouped[key] = { inboxSum: 0, inboxCount: 0, commentSum: 0, commentCount: 0 };
  }

  for (const r of records) {
    if (!r.customerMessageAt || r.responseTimeMinutes === null) continue;
    const key = r.customerMessageAt.toISOString().slice(0, 10);
    if (!grouped[key]) continue;
    if (r.conversationType === "INBOX") {
      grouped[key].inboxSum += r.responseTimeMinutes;
      grouped[key].inboxCount++;
    } else if (r.conversationType === "COMMENT") {
      grouped[key].commentSum += r.responseTimeMinutes;
      grouped[key].commentCount++;
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => {
      const [, mm, dd] = date.split("-");
      return {
        date: `${dd}/${mm}`,
        inbox: val.inboxCount > 0 ? Math.round(val.inboxSum / val.inboxCount) : null,
        comment: val.commentCount > 0 ? Math.round(val.commentSum / val.commentCount) : null,
      };
    });
}
