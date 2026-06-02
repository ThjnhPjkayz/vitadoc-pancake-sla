import { prisma } from "@/lib/prisma";

export async function GET() {
  const [pageCount, convCount, msgCount, slaCount] = await Promise.all([
    prisma.page.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.sLAViolation.count(),
  ]);

  return Response.json({
    success: true,
    status: "Pancake SLA Monitoring Tool",
    database: {
      pages: pageCount,
      conversations: convCount,
      messages: msgCount,
      slaViolations: slaCount,
    },
    endpoints: {
      sync: "POST /api/sync",
      sla: "GET /api/sla",
      slaByPage: "GET /api/sla?pageId=xxx",
    },
  });
}