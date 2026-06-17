-- Thêm cột tags (lưu theo TEXT, vd "Đã kết bạn") + GIN index cho truy vấn theo tag
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "Conversation_tags_idx" ON "Conversation" USING GIN ("tags");
