// ============================================================
// Dashboard Service — Prisma queries optimized cho dashboard
// ============================================================

import { prisma } from "@/lib/prisma";

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
  onTimeCount: number;
  pagesAtLimit: number; // Số page có đúng 60 conversations (có thể thiếu dữ liệu)
}

export interface ConversationFilter {
  search?: string;
  pageId?: string;
  platform?: string;
  slaStatus?: "on-time" | "late" | "no-reply";
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
  customerMessageAt: string | null;
  conversationType: string;
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
  ]);

  // Đếm số page có đúng 60 conversations (có thể đang bị giới hạn API)
  const pagesAtLimit = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM (SELECT "pageId", COUNT(*) as cnt FROM "Conversation" GROUP BY "pageId" HAVING COUNT(*) = 60) sub`
  ).then((r) => Number(r[0].count));

  const totalSLA = slaAgg._count.id;
  const lateReply =
    slaGrouped.find((g) => g.isLateReply)?._count.id ?? 0;
  const onTime =
    slaGrouped.find((g) => !g.isLateReply)?._count.id ?? 0;

  return {
    totalPages,
    totalConversations,
    totalMessages,
    totalSLAViolations: totalSLA,
    avgResponseTimeMinutes: Math.round(
      slaAgg._avg.responseTimeMinutes ?? 0
    ),
    slaSuccessRate: totalSLA > 0 ? onTime / totalSLA : 0,
    lateReplyCount: lateReply,
    onTimeCount: onTime,
    pagesAtLimit,
  };
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
    slaStatus,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
    sortBy = "customerMessageAt",
    sortOrder = "desc",
  } = filter;

  // Build SLA where conditions
  const slaWhere: Record<string, unknown> = {};

  if (slaStatus === "on-time") {
    slaWhere.isLateReply = false;
    slaWhere.responseTimeMinutes = { not: null };
  } else if (slaStatus === "late") {
    slaWhere.isLateReply = true;
  } else if (slaStatus === "no-reply") {
    slaWhere.responseTimeMinutes = null;
  }

  if (dateFrom || dateTo) {
    slaWhere.customerMessageAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  // Build page where
  const pageWhere: Record<string, unknown> = {};
  if (platform) pageWhere.platform = platform;
  if (search) {
    pageWhere.name = { contains: search, mode: "insensitive" };
  }

  // Main query
  const where: Record<string, unknown> = {};
  if (pageId) where.pageId = pageId;

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
      orderBy: {
        [sortBy === "customerName"
          ? "conversation"
          : sortBy === "responseTimeMinutes"
          ? "responseTimeMinutes"
          : "customerMessageAt"]: sortOrder,
      },
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
      customerMessageAt: row.customerMessageAt?.toISOString() ?? null,
      conversationType: row.conversation.type,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
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

  // Lấy dữ liệu 30 ngày gần nhất
  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const violations = await prisma.sLAViolation.findMany({
    where: {
      ...wherePage,
      customerMessageAt: { gte: since },
    },
    select: {
      customerMessageAt: true,
      isLateReply: true,
      responseTimeMinutes: true,
    },
    orderBy: { customerMessageAt: "asc" },
  });

  // Group by date
  const grouped: Record<
    string,
    { total: number; violations: number; totalTime: number }
  > = {};

  // Init all dates
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
      avgResponseTime: val.total > 0 ? Math.round(val.totalTime / val.total) : 0,
    }));
}
