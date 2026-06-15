// ============================================================
// One-time fix: dịch các mốc thời gian đã sync sai +7 giờ.
//
// Bối cảnh: parsePancakeDate trước đây gắn "+07:00" trong khi API Pancake
// trả giờ UTC → mọi timestamp đã lưu bị SỚM 7 tiếng. Bản fix đã sửa parse
// (gắn "Z"), nhưng dữ liệu CŨ không tự sửa được vì message dùng
// createMany({ skipDuplicates }) → re-sync không cập nhật. Script này cộng 7h
// cho dữ liệu cũ.
//
// ⚠️ CHẠY ĐÚNG MỘT LẦN, NGAY SAU KHI DEPLY BẢN FIX PARSE và TRƯỚC khi chạy
//    sync mới (vì sync mới đã ghi giờ đúng, không được +7h nữa).
//
// Cách chạy:  npx tsx scripts/fix-timezone.ts --confirm
//    (cần DATABASE_URL trỏ tới DB production)
// ============================================================

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--confirm")) {
    const [msg, conv, sla] = await Promise.all([
      prisma.message.count(),
      prisma.conversation.count(),
      prisma.sLAViolation.count(),
    ]);
    console.log("DRY RUN — chưa thay đổi gì. Sẽ cộng 7h cho:");
    console.log(`  Message.insertedAt           : ${msg} dòng`);
    console.log(`  Conversation.insertedAt/updatedAtConv : ${conv} dòng`);
    console.log(`  SLAViolation.customerMessageAt/adminReplyAt : ${sla} dòng`);
    console.log("\n⚠️ Chạy ĐÚNG MỘT LẦN. Để thực thi:  npx tsx scripts/fix-timezone.ts --confirm");
    return;
  }

  console.log("Đang dịch +7h cho dữ liệu cũ...");

  const m = await prisma.$executeRawUnsafe(
    `UPDATE "Message" SET "insertedAt" = "insertedAt" + interval '7 hours'`
  );
  console.log(`  ✅ Message: ${m} dòng`);

  const c = await prisma.$executeRawUnsafe(
    `UPDATE "Conversation" SET "insertedAt" = "insertedAt" + interval '7 hours', "updatedAtConv" = "updatedAtConv" + interval '7 hours'`
  );
  console.log(`  ✅ Conversation: ${c} dòng`);

  const s = await prisma.$executeRawUnsafe(
    `UPDATE "SLAViolation" SET "customerMessageAt" = "customerMessageAt" + interval '7 hours', "adminReplyAt" = "adminReplyAt" + interval '7 hours' WHERE "customerMessageAt" IS NOT NULL`
  );
  console.log(`  ✅ SLAViolation: ${s} dòng`);

  console.log("\n🎉 Xong. Khuyến nghị chạy Full Sync để tính lại cờ outsideBusinessHours/isLateReply theo giờ đúng.");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
