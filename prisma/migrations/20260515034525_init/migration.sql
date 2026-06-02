-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customerName" TEXT,
    "customerUsername" TEXT,
    "pageId" TEXT,
    "pageName" TEXT,
    "conversationType" TEXT,
    "customerMessageAt" TIMESTAMP(3),
    "firstReplyAt" TIMESTAMP(3),
    "responseTimeMinutes" INTEGER,
    "isLateReply" BOOLEAN NOT NULL DEFAULT false,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_isLateReply_idx" ON "Conversation"("isLateReply");

-- CreateIndex
CREATE INDEX "Conversation_responseTimeMinutes_idx" ON "Conversation"("responseTimeMinutes");

-- CreateIndex
CREATE INDEX "Conversation_customerMessageAt_idx" ON "Conversation"("customerMessageAt");
