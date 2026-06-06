// Quick DB state check for /verify skill
// Run: node scripts/verify-db.js [sync|dashboard|sla|all]

const { PrismaClient } = require("../app/generated/prisma/index.js");

const mode = process.argv[2] || "all";
const prisma = new PrismaClient();

async function main() {
  if (mode === "sync" || mode === "all") {
    const history = await prisma.syncHistory.findMany({
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        pagesCount: true,
        conversationsCount: true,
        messagesCount: true,
        slaChecked: true,
        errors: true,
      },
    });
    console.log("=== Sync History (last 3) ===");
    console.log(JSON.stringify(history, null, 2));
  }

  if (mode === "dashboard" || mode === "all") {
    const [pages, convs, msgs, sla, late, pending] = await Promise.all([
      prisma.page.count({ where: { isActivated: true } }),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.sLAViolation.count(),
      prisma.sLAViolation.count({ where: { isLateReply: true } }),
      prisma.sLAViolation.count({ where: { slaStatus: "pending" } }),
    ]);
    const onTime = sla - late - pending;
    console.log("=== Dashboard Stats ===");
    console.log(JSON.stringify({ pages, convs, msgs, sla_total: sla, late, pending, onTime }, null, 2));
  }

  if (mode === "sla" || mode === "all") {
    const sample = await prisma.sLAViolation.findMany({
      take: 3,
      orderBy: { customerMessageAt: "desc" },
      select: {
        conversationId: true,
        slaStatus: true,
        responseTimeMinutes: true,
        effectiveResponseMinutes: true,
        outsideBusinessHours: true,
        conversationType: true,
      },
    });
    console.log("=== Sample SLA Records ===");
    console.log(JSON.stringify(sample, null, 2));
  }
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
