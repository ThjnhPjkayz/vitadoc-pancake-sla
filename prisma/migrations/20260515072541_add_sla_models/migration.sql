/*
  Warnings:

  - You are about to drop the column `conversationType` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `customerMessageAt` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `firstReplyAt` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `isLateReply` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `pageName` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `responseTimeMinutes` on the `Conversation` table. All the data in the column will be lost.
  - Added the required column `type` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Made the column `pageId` on table `Conversation` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Conversation_customerMessageAt_idx";

-- DropIndex
DROP INDEX "Conversation_isLateReply_idx";

-- DropIndex
DROP INDEX "Conversation_responseTimeMinutes_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "conversationType",
DROP COLUMN "customerMessageAt",
DROP COLUMN "firstReplyAt",
DROP COLUMN "isLateReply",
DROP COLUMN "pageName",
DROP COLUMN "responseTimeMinutes",
ADD COLUMN     "assigneeIds" JSONB,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "hasPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insertedAt" TIMESTAMP(3),
ADD COLUMN     "lastSentById" TEXT,
ADD COLUMN     "lastSentByName" TEXT,
ADD COLUMN     "messageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "postId" TEXT,
ADD COLUMN     "seen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snippet" TEXT,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAtConv" TIMESTAMP(3),
ALTER COLUMN "pageId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "platform" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isActivated" BOOLEAN NOT NULL DEFAULT true,
    "shopId" INTEGER,
    "timezone" DOUBLE PRECISION,
    "pageAccessToken" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "message" TEXT,
    "type" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT,
    "fromUsername" TEXT,
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isFromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "hasPhone" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "insertedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLAViolation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "customerMessageId" TEXT NOT NULL,
    "customerMessageAt" TIMESTAMP(3) NOT NULL,
    "adminReplyMessageId" TEXT,
    "adminReplyAt" TIMESTAMP(3),
    "responseTimeMinutes" INTEGER,
    "isLateReply" BOOLEAN NOT NULL DEFAULT false,
    "slaThresholdMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SLAViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_platform_idx" ON "Page"("platform");

-- CreateIndex
CREATE INDEX "Page_isActivated_idx" ON "Page"("isActivated");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_pageId_idx" ON "Message"("pageId");

-- CreateIndex
CREATE INDEX "Message_isFromCustomer_idx" ON "Message"("isFromCustomer");

-- CreateIndex
CREATE INDEX "Message_isFromAdmin_idx" ON "Message"("isFromAdmin");

-- CreateIndex
CREATE INDEX "Message_insertedAt_idx" ON "Message"("insertedAt");

-- CreateIndex
CREATE INDEX "SLAViolation_isLateReply_idx" ON "SLAViolation"("isLateReply");

-- CreateIndex
CREATE INDEX "SLAViolation_pageId_idx" ON "SLAViolation"("pageId");

-- CreateIndex
CREATE INDEX "SLAViolation_customerMessageAt_idx" ON "SLAViolation"("customerMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_pageId_idx" ON "Conversation"("pageId");

-- CreateIndex
CREATE INDEX "Conversation_customerId_idx" ON "Conversation"("customerId");

-- CreateIndex
CREATE INDEX "Conversation_insertedAt_idx" ON "Conversation"("insertedAt");

-- CreateIndex
CREATE INDEX "Conversation_seen_idx" ON "Conversation"("seen");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLAViolation" ADD CONSTRAINT "SLAViolation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLAViolation" ADD CONSTRAINT "SLAViolation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
