import { PrismaClient } from "@/app/generated/prisma";

// ⚠️ Timeout TOÀN CỤC cho mọi query Prisma. Neon serverless có thể treo
// connection (lag / pool cạn); nếu không có timeout, 1 query treo sẽ làm
// function chờ tới maxDuration (300s) rồi 504. Extension này bọc MỌI thao tác
// DB — kể cả những chỗ không dùng withRetry — nên không query nào treo quá hạn.
const QUERY_TIMEOUT_MS = 15_000;

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ args, query }) {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("DB operation timeout")),
            QUERY_TIMEOUT_MS
          )
        );
        const op = query(args);
        op.catch(() => {}); // nuốt rejection muộn nếu op thua race
        return Promise.race([op, timeout]);
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
