@AGENTS.md

# Pancake SLA Tool

Dashboard giám sát SLA (Service Level Agreement) cho hệ thống chat Pancake (pages.fm). Đồng bộ dữ liệu hội thoại từ Pancake API về PostgreSQL, tính toán thời gian phản hồi, và hiển thị báo cáo vi phạm SLA.

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL (NeonDB serverless) |
| ORM | Prisma 6 — client output tại `app/generated/prisma` |
| Auth | NextAuth v5 beta (JWT strategy, credentials provider) |
| UI | Tailwind CSS v4, shadcn/ui, Recharts |
| Deploy | Vercel (cron job tích hợp) |
| Dev port | 4000 (`npm run dev`) |

---

## Cấu trúc thư mục

```
app/
  (protected)/          # Routes cần auth (layout wrap)
    dashboard/page.tsx  # Trang chính — stats + sync UI
    conversations/      # Bảng lọc hội thoại
    pages/              # Leaderboard theo page
    config/             # Cấu hình SLA
  api/
    auth/[...nextauth]/ # NextAuth handler
    sync/               # POST/DELETE/GET — trigger/cancel/status sync
    sync/page/          # POST — sync 1 batch conversation (cursor-paginated)
    sync/finalize/      # POST — đánh dấu sync hoàn tất
    cron/sync/          # GET — Vercel cron job (23:59 VN daily)
    dashboard/          # stats, conversations, pages, violations-trend, response-time-trend
    config/             # GET/POST SLA config
    sla/                # Recalculate SLA
lib/
  services/
    pancake-api.ts      # HTTP client gọi pages.fm API
    sync.ts             # Orchestrator: Pancake → PostgreSQL
    sla.ts              # Engine tính SLA
    sla-config.ts       # Config giờ làm việc + ngưỡng SLA (lưu file data/sla-config.json)
    dashboard.ts        # Prisma queries cho dashboard
    sync-progress.ts    # In-memory progress tracking (dùng cho cron)
  prisma.ts             # Prisma singleton
  i18n/                 # Đa ngôn ngữ (vi/en/zh)
prisma/schema.prisma    # Schema DB
scripts/
  create-user.ts        # Tạo user: npx tsx scripts/create-user.ts
  reset-sync.ts         # Reset sync history
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://...   # NeonDB pooler (dùng cho Prisma thông thường)
DIRECT_URL=postgresql://...     # NeonDB direct (dùng cho migrations)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
PANCAKE_ACCESS_TOKEN=...        # JWT token user Pancake (có TTL — cần gia hạn)
CRON_SECRET=...                 # Header auth cho /api/cron/sync
```

---

## Database Schema

### 5 models chính:

**Page** — Fanpage/TikTok page từ Pancake
- `id`: page_id từ Pancake (vd: `tt_7582800065863402517`)
- `platform`: `tiktok | facebook | personal_zalo | tiktok_business_messaging`
- `pageAccessToken`: token riêng để gọi conversations API (lưu vào DB sau khi generate)

**Conversation** — Hội thoại
- `type`: `INBOX | COMMENT`
- `insertedAt` / `updatedAtConv`: timestamp từ Pancake (parse `+07:00` vì API không trả timezone)

**Message** — Tin nhắn
- `isFromCustomer` / `isFromAdmin`: phân loại nguồn gửi
- `insertedAt`: parse `+07:00`

**SLAViolation** — Kết quả tính SLA (upsert, id = `{conversationId}_sla`)
- `slaStatus`: `on-time | late | pending | outbound`
- `effectiveResponseMinutes`: chỉ đếm phút trong giờ làm việc
- `outsideBusinessHours`: tin nhắn đầu của khách nằm ngoài giờ làm việc
- `slaGroup`: nhóm SLA (nullable)

**SyncHistory** — Lịch sử sync
- `status`: `running | success | failed | cancelled`
- `progressSnapshot`: JSON snapshot progress (dùng để UI polling qua `/api/sync GET`)

---

## Luồng Sync (Pancake → DB)

Sync được thiết kế để tránh timeout 60s của Vercel bằng cách chia nhỏ theo **cursor pagination** ở cấp conversation.

### Manual sync (từ dashboard):

```
1. POST /api/sync
   → Lấy danh sách pages từ Pancake API
   → Tạo SyncHistory record (status=running)
   → Trả về { syncId, pages[], since }

2. Client loop qua từng page:
   └─ cursor loop (lặp đến khi nextCursor === null):
      POST /api/sync/page { syncId, page, cursor, since, ... }
      → Lần đầu (cursor=null): upsert page + generate pageAccessToken
      → Lần tiếp (cursor!=null): đọc token từ DB
      → Gọi Pancake API lấy 60 conversations (1 page)
      → Với mỗi conversation: fetch messages nếu message_count thay đổi
      → Tính SLA cho từng conversation
      → Trả về { stats, nextCursor }

3. POST /api/sync/finalize { syncId, totals, errors }
   → Cập nhật SyncHistory: status=success/failed/cancelled
```

### Cron job (23:59 VN mỗi ngày):
- `GET /api/cron/sync` với header `Authorization: Bearer {CRON_SECRET}`
- Gọi thẳng `syncAllPages()` — loops toàn bộ cursor pages trong 1 request (maxDuration=300s)
- **Bị tắt trên local** — chỉ chạy trên Vercel production

### Incremental sync:
- Mặc định chỉ sync conversations có `updated_at >= lastSuccessAt - 5 phút`
- Dừng sớm khi cả batch đều cũ hơn ngưỡng
- Force sync: bỏ qua incremental, fetch toàn bộ

### Quan trọng — parse datetime:
```typescript
// Pancake trả "2024-01-15T10:30:00" KHÔNG có timezone
// Phải thêm "+07:00" để parse đúng UTC+7
new Date(str + "+07:00")
```

---

## SLA Logic

### Ngưỡng mặc định (lưu tại `data/sla-config.json`):

| Loại | Trong giờ | Ngoài giờ |
|---|---|---|
| INBOX | 15 phút | 30 phút |
| COMMENT | 60 phút | 120 phút |

### Giờ làm việc mặc định:
- 08:00 – 18:00, Thứ 2 – Thứ 7

### Tính `effectiveResponseMinutes`:
- Chỉ tính phút **trong giờ làm việc** (bỏ qua đêm/cuối tuần)
- So sánh với ngưỡng để xác định `isLateReply`

### Trạng thái SLA:
- `on-time`: có phản hồi, effectiveResponseMinutes ≤ threshold
- `late`: có phản hồi, effectiveResponseMinutes > threshold
- `pending`: chưa có phản hồi của admin
- `outbound`: conversation do admin khởi tạo (không có tin khách hàng trước)

---

## Auth

- NextAuth v5 beta, JWT strategy
- Credentials provider: email + bcrypt password
- Tạo user mới: `npm run create-user`

**Test accounts:**
- `admin@pancake.vn` / `admin123`
- `Guanbin@vitadoc.vn` / `admin123`

---

## API Routes quan trọng

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/sync` | Khởi động sync, trả về pages list |
| POST | `/api/sync/page` | Sync 1 batch conversations (60 conversations/call) |
| POST | `/api/sync/finalize` | Đánh dấu sync hoàn tất |
| DELETE | `/api/sync` | Cancel sync đang chạy |
| GET | `/api/sync` | Status + progress sync gần nhất |
| GET | `/api/sync?history=true` | Lịch sử 20 lần sync gần nhất |
| GET | `/api/cron/sync` | Cron job endpoint (cần Bearer header) |
| GET | `/api/dashboard/stats` | Dashboard stats cards |
| GET | `/api/dashboard/conversations` | Bảng conversations (filter + paginate) |
| GET | `/api/dashboard/pages` | Leaderboard theo page |
| GET | `/api/dashboard/violations-trend` | Trend chart vi phạm (7/30/90 ngày) |
| GET | `/api/dashboard/response-time-trend` | Trend chart thời gian phản hồi |
| GET/POST | `/api/config` | Đọc/ghi SLA config |
| POST | `/api/sla` | Tính lại SLA pending |

---

## Pancake API

Base URL: `https://pages.fm/api`

- Pagination conversations: cursor-based (`before_id`), 60 items/page
- Rate limit: 300ms delay giữa các cursor pages, 500ms giữa các pages
- Retry: 3 lần với exponential backoff (1s, 2s, 3s)
- Timeout per request: 30s

---

## Lưu ý Quan Trọng

- `POST /api/sync` **bị tắt trên local** (`NODE_ENV === 'development'`). Dùng cron endpoint với CRON_SECRET để test local.
- Prisma client output tại `app/generated/prisma` (không phải `node_modules`) — cần chạy `prisma generate` trước build.
- `data/sla-config.json` lưu config SLA — file này không được commit, Vercel sẽ mất khi redeploy (nên migrate sang DB nếu cần persistent config).
- `PANCAKE_ACCESS_TOKEN` có TTL (hết hạn ~2027) — hardcode trong `pancake-api.ts` với fallback từ env.
- Vercel cron schedule `"59 16 * * *"` = UTC 16:59 = VN 23:59.
