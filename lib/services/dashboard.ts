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
  lateInboxCount: number;
  lateCommentCount: number;
  onTimeInboxCount: number;
  onTimeCommentCount: number;
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
// Period stats with comparison (Vietnam UTC+7)
// ----------------------------------------------------------------

export type PeriodKey = "yesterday" | "7d" | "30d";

export interface PeriodStats {
  label: string;          // e.g. "2025-06-08" or "02/06–08/06"
  totalResolved: number;
  lateCount: number;
  onTimeCount: number;
  inHoursViolations: number;
  afterHoursViolations: number;
  avgResponseTimeMinutes: number;
  slaSuccessRate: number;
}

export interface PeriodComparison {
  current: PeriodStats;
  prev: PeriodStats;
}

const VN_OFFSET_MS_STATS = 7 * 3_600_000;

function getVnMidnightUtc(daysAgo: number): Date {
  const vnNow = Date.now() + VN_OFFSET_MS_STATS;
  const vnMidnightToday = vnNow - (vnNow % 86_400_000);
  return new Date(vnMidnightToday - daysAgo * 86_400_000 - VN_OFFSET_MS_STATS);
}

function fmtDate(d: Date): string {
  const vn = new Date(d.getTime() + VN_OFFSET_MS_STATS);
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function periodRanges(period: PeriodKey): { curFrom: Date; curTo: Date; prevFrom: Date; prevTo: Date; label: string } {
  const today   = getVnMidnightUtc(0);
  const d1      = getVnMidnightUtc(1);
  const d2      = getVnMidnightUtc(2);
  const d7      = getVnMidnightUtc(7);
  const d14     = getVnMidnightUtc(14);
  const d30     = getVnMidnightUtc(30);
  const d60     = getVnMidnightUtc(60);

  if (period === "yesterday") {
    return { curFrom: d1, curTo: today, prevFrom: d2, prevTo: d1,
      label: new Date(d1.getTime() + VN_OFFSET_MS_STATS).toISOString().slice(0, 10) };
  }
  if (period === "7d") {
    return { curFrom: d7, curTo: today, prevFrom: d14, prevTo: d7,
      label: `${fmtDate(d7)}–${fmtDate(d1)}` };
  }
  // 30d
  return { curFrom: d30, curTo: today, prevFrom: d60, prevTo: d30,
    label: `${fmtDate(d30)}–${fmtDate(d1)}` };
}

async function fetchPeriodStats(from: Date, to: Date, label: string, pageId?: string): Promise<PeriodStats> {
  const where = {
    customerMessageAt: { gte: from, lt: to },
    slaStatus: { not: "outbound" as const },
    ...(pageId ? { pageId } : {}),
  };

  const [lateCount, onTimeCount, inHoursViolations, afterHoursViolations, avgAgg] = await Promise.all([
    prisma.sLAViolation.count({ where: { ...where, isLateReply: true } }),
    prisma.sLAViolation.count({ where: { ...where, isLateReply: false, responseTimeMinutes: { not: null } } }),
    prisma.sLAViolation.count({ where: { ...where, isLateReply: true, outsideBusinessHours: false } }),
    prisma.sLAViolation.count({ where: { ...where, isLateReply: true, outsideBusinessHours: true } }),
    prisma.sLAViolation.aggregate({
      where: { ...where, responseTimeMinutes: { not: null } },
      _avg: { responseTimeMinutes: true },
      _count: { id: true },
    }),
  ]);

  const totalResolved = avgAgg._count.id;
  return {
    label,
    totalResolved,
    lateCount,
    onTimeCount,
    inHoursViolations,
    afterHoursViolations,
    avgResponseTimeMinutes: Math.round(avgAgg._avg.responseTimeMinutes ?? 0),
    slaSuccessRate: totalResolved > 0 ? onTimeCount / totalResolved : 0,
  };
}

export async function getPeriodComparison(period: PeriodKey = "yesterday", pageId?: string): Promise<PeriodComparison> {
  const { curFrom, curTo, prevFrom, prevTo, label } = periodRanges(period);
  const prevLabel = period === "yesterday" ? "hôm kia" : `trước đó`;
  const [current, prev] = await Promise.all([
    fetchPeriodStats(curFrom, curTo, label, pageId),
    fetchPeriodStats(prevFrom, prevTo, prevLabel, pageId),
  ]);
  return { current, prev };
}

// ----------------------------------------------------------------
// Get Page Summaries (leaderboard)
// ----------------------------------------------------------------

export async function getPageSummaries(dateFrom?: Date, dateTo?: Date): Promise<PageSummary[]> {
  const dateFilter = dateFrom
    ? dateTo
      ? Prisma.sql`AND s."customerMessageAt" >= ${dateFrom} AND s."customerMessageAt" < ${dateTo}`
      : Prisma.sql`AND s."customerMessageAt" >= ${dateFrom}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<
    Array<{
      pageId: string;
      pageName: string;
      platform: string;
      total: bigint;
      lateCount: bigint;
      lateInboxCount: bigint;
      lateCommentCount: bigint;
      onTimeInboxCount: bigint;
      onTimeCommentCount: bigint;
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
      SUM(CASE WHEN s."isLateReply" = true AND s."conversationType" = 'INBOX'   THEN 1 ELSE 0 END) AS "lateInboxCount",
      SUM(CASE WHEN s."isLateReply" = true AND s."conversationType" = 'COMMENT' THEN 1 ELSE 0 END) AS "lateCommentCount",
      COUNT(CASE WHEN s."slaStatus" = 'on-time' AND s."conversationType" = 'INBOX'   THEN 1 END)   AS "onTimeInboxCount",
      COUNT(CASE WHEN s."slaStatus" = 'on-time' AND s."conversationType" = 'COMMENT' THEN 1 END)   AS "onTimeCommentCount",
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
        lateInboxCount: Number(r.lateInboxCount),
        lateCommentCount: Number(r.lateCommentCount),
        onTimeInboxCount: Number(r.onTimeInboxCount),
        onTimeCommentCount: Number(r.onTimeCommentCount),
        pendingCount,
        pendingBreachedCount,
        onTimeCount,
        avgResponseTimeMinutes: r.avgResponseTimeMinutes ? Math.round(r.avgResponseTimeMinutes) : 0,
        avgInboxResponseTimeMinutes: r.avgInboxResponseTimeMinutes ? Math.round(r.avgInboxResponseTimeMinutes) : 0,
        avgCommentResponseTimeMinutes: r.avgCommentResponseTimeMinutes ? Math.round(r.avgCommentResponseTimeMinutes) : 0,
        lateRate: resolvedCount > 0 ? lateCount / resolvedCount : 0,
      };
    })
    .sort((a, b) => b.lateCount - a.lateCount);
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
    // dateTo là biên trên LOẠI TRỪ (đầu ngày sau period) từ useGlobalPeriod → dùng `lt`.
    // (Trước đây cộng thêm 1 ngày → "hôm qua" lại bao gồm cả hôm nay.)
    slaWhere.customerMessageAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lt: new Date(dateTo) } : {}),
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
            // dateTo là biên trên LOẠI TRỪ (đầu ngày sau period) → dùng `lt`, không cộng ngày.
            ...(dateTo ? { lt: new Date(dateTo) } : {}),
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
// Yesterday trend — grouped by hour (VN UTC+7)
// ----------------------------------------------------------------

const VN_OFFSET_MS = 7 * 3_600_000;

function getYesterdayVnRange(): { from: Date; to: Date } {
  const vnNow = Date.now() + VN_OFFSET_MS;
  const vnMidnightToday = vnNow - (vnNow % 86_400_000);
  return {
    from: new Date(vnMidnightToday - 86_400_000 - VN_OFFSET_MS),
    to:   new Date(vnMidnightToday - VN_OFFSET_MS),
  };
}

export async function getViolationsTrendHourly(pageId?: string): Promise<ViolationsTrendDay[]> {
  const { from, to } = getYesterdayVnRange();

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...(pageId ? { pageId } : {}),
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: from, lt: to },
    },
    select: { customerMessageAt: true, isLateReply: true },
  });

  const grouped: Record<number, { late: number; onTime: number }> = {};
  for (let h = 0; h < 24; h++) grouped[h] = { late: 0, onTime: 0 };

  for (const r of records) {
    if (!r.customerMessageAt) continue;
    const vnHour = Math.floor((r.customerMessageAt.getTime() + VN_OFFSET_MS) / 3_600_000) % 24;
    if (r.isLateReply) grouped[vnHour].late++;
    else grouped[vnHour].onTime++;
  }

  return Array.from({ length: 24 }, (_, h) => ({
    date: `${String(h).padStart(2, "0")}h`,
    ...grouped[h],
  }));
}

export async function getResponseTimeTrendHourly(pageId?: string): Promise<ResponseTimeTrendDay[]> {
  const { from, to } = getYesterdayVnRange();

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...(pageId ? { pageId } : {}),
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: from, lt: to },
    },
    select: { customerMessageAt: true, conversationType: true, responseTimeMinutes: true },
  });

  const grouped: Record<number, { inboxSum: number; inboxCount: number; commentSum: number; commentCount: number }> = {};
  for (let h = 0; h < 24; h++) grouped[h] = { inboxSum: 0, inboxCount: 0, commentSum: 0, commentCount: 0 };

  for (const r of records) {
    if (!r.customerMessageAt || r.responseTimeMinutes === null) continue;
    const vnHour = Math.floor((r.customerMessageAt.getTime() + VN_OFFSET_MS) / 3_600_000) % 24;
    if (r.conversationType === "INBOX") {
      grouped[vnHour].inboxSum += r.responseTimeMinutes;
      grouped[vnHour].inboxCount++;
    } else if (r.conversationType === "COMMENT") {
      grouped[vnHour].commentSum += r.responseTimeMinutes;
      grouped[vnHour].commentCount++;
    }
  }

  return Array.from({ length: 24 }, (_, h) => ({
    date: `${String(h).padStart(2, "0")}h`,
    inbox:   grouped[h].inboxCount   > 0 ? Math.round(grouped[h].inboxSum   / grouped[h].inboxCount)   : null,
    comment: grouped[h].commentCount > 0 ? Math.round(grouped[h].commentSum / grouped[h].commentCount) : null,
  }));
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

// ----------------------------------------------------------------
// Custom date range: stats, violations trend, response time trend
// ----------------------------------------------------------------

export async function getStatsForDateRange(dateFrom: Date, dateTo: Date, pageId?: string): Promise<PeriodStats> {
  const label = `${fmtDate(dateFrom)}–${fmtDate(new Date(dateTo.getTime() - 1))}`;
  return fetchPeriodStats(dateFrom, dateTo, label, pageId);
}

export async function getViolationsTrendForRange(dateFrom: Date, dateTo: Date, pageId?: string): Promise<ViolationsTrendDay[]> {
  const diffDays = (dateTo.getTime() - dateFrom.getTime()) / 86_400_000;

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...(pageId ? { pageId } : {}),
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: dateFrom, lt: dateTo },
    },
    select: { customerMessageAt: true, isLateReply: true },
  });

  if (diffDays <= 1) {
    // Hourly grouping
    const grouped: Record<number, { late: number; onTime: number }> = {};
    for (let h = 0; h < 24; h++) grouped[h] = { late: 0, onTime: 0 };
    for (const r of records) {
      if (!r.customerMessageAt) continue;
      const vnHour = Math.floor((r.customerMessageAt.getTime() + VN_OFFSET_MS) / 3_600_000) % 24;
      if (r.isLateReply) grouped[vnHour].late++;
      else grouped[vnHour].onTime++;
    }
    return Array.from({ length: 24 }, (_, h) => ({
      date: `${String(h).padStart(2, "0")}h`,
      ...grouped[h],
    }));
  }

  // Daily grouping
  const days = Math.ceil(diffDays);
  const grouped: Record<string, { late: number; onTime: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom.getTime() + i * 86_400_000 + VN_OFFSET_MS);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    grouped[key] = { late: 0, onTime: 0 };
  }
  for (const r of records) {
    if (!r.customerMessageAt) continue;
    const vnDate = new Date(r.customerMessageAt.getTime() + VN_OFFSET_MS);
    const key = `${vnDate.getUTCFullYear()}-${String(vnDate.getUTCMonth() + 1).padStart(2, "0")}-${String(vnDate.getUTCDate()).padStart(2, "0")}`;
    if (!grouped[key]) continue;
    if (r.isLateReply) grouped[key].late++;
    else grouped[key].onTime++;
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => {
      const [, mm, dd] = date.split("-");
      return { date: `${dd}/${mm}`, ...val };
    });
}

export async function getResponseTimeTrendForRange(dateFrom: Date, dateTo: Date, pageId?: string): Promise<ResponseTimeTrendDay[]> {
  const diffDays = (dateTo.getTime() - dateFrom.getTime()) / 86_400_000;

  const records = await prisma.sLAViolation.findMany({
    where: {
      ...(pageId ? { pageId } : {}),
      responseTimeMinutes: { not: null },
      customerMessageAt: { gte: dateFrom, lt: dateTo },
    },
    select: { customerMessageAt: true, conversationType: true, responseTimeMinutes: true },
  });

  if (diffDays <= 1) {
    const grouped: Record<number, { inboxSum: number; inboxCount: number; commentSum: number; commentCount: number }> = {};
    for (let h = 0; h < 24; h++) grouped[h] = { inboxSum: 0, inboxCount: 0, commentSum: 0, commentCount: 0 };
    for (const r of records) {
      if (!r.customerMessageAt || r.responseTimeMinutes === null) continue;
      const vnHour = Math.floor((r.customerMessageAt.getTime() + VN_OFFSET_MS) / 3_600_000) % 24;
      if (r.conversationType === "INBOX") { grouped[vnHour].inboxSum += r.responseTimeMinutes; grouped[vnHour].inboxCount++; }
      else if (r.conversationType === "COMMENT") { grouped[vnHour].commentSum += r.responseTimeMinutes; grouped[vnHour].commentCount++; }
    }
    return Array.from({ length: 24 }, (_, h) => ({
      date: `${String(h).padStart(2, "0")}h`,
      inbox:   grouped[h].inboxCount   > 0 ? Math.round(grouped[h].inboxSum   / grouped[h].inboxCount)   : null,
      comment: grouped[h].commentCount > 0 ? Math.round(grouped[h].commentSum / grouped[h].commentCount) : null,
    }));
  }

  const days = Math.ceil(diffDays);
  const grouped: Record<string, { inboxSum: number; inboxCount: number; commentSum: number; commentCount: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom.getTime() + i * 86_400_000 + VN_OFFSET_MS);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    grouped[key] = { inboxSum: 0, inboxCount: 0, commentSum: 0, commentCount: 0 };
  }
  for (const r of records) {
    if (!r.customerMessageAt || r.responseTimeMinutes === null) continue;
    const vnDate = new Date(r.customerMessageAt.getTime() + VN_OFFSET_MS);
    const key = `${vnDate.getUTCFullYear()}-${String(vnDate.getUTCMonth() + 1).padStart(2, "0")}-${String(vnDate.getUTCDate()).padStart(2, "0")}`;
    if (!grouped[key]) continue;
    if (r.conversationType === "INBOX") { grouped[key].inboxSum += r.responseTimeMinutes; grouped[key].inboxCount++; }
    else if (r.conversationType === "COMMENT") { grouped[key].commentSum += r.responseTimeMinutes; grouped[key].commentCount++; }
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => {
      const [, mm, dd] = date.split("-");
      return {
        date: `${dd}/${mm}`,
        inbox:   val.inboxCount   > 0 ? Math.round(val.inboxSum   / val.inboxCount)   : null,
        comment: val.commentCount > 0 ? Math.round(val.commentSum / val.commentCount) : null,
      };
    });
}
