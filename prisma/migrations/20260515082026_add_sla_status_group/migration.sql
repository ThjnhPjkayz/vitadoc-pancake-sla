/*
  Warnings:

  - You are about to drop the column `isLateReply` on the `SLAViolation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[conversationId]` on the table `SLAViolation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `SLAViolation` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SLAViolation_isLateReply_idx";

-- AlterTable
ALTER TABLE "SLAViolation" DROP COLUMN "isLateReply",
ADD COLUMN     "slaGroup" TEXT NOT NULL DEFAULT 'no_reply',
ADD COLUMN     "slaStatus" TEXT NOT NULL DEFAULT 'no_reply',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "SLAViolation_slaStatus_idx" ON "SLAViolation"("slaStatus");

-- CreateIndex
CREATE INDEX "SLAViolation_slaGroup_idx" ON "SLAViolation"("slaGroup");

-- CreateIndex
CREATE UNIQUE INDEX "SLAViolation_conversationId_key" ON "SLAViolation"("conversationId");
