import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.syncHistory.updateMany({
    where: { status: "running" },
    data: { status: "cancelled", completedAt: new Date() },
  });
  console.log(`Reset ${updated.count} stuck sync record(s).`);
}

main().finally(() => prisma.$disconnect());
