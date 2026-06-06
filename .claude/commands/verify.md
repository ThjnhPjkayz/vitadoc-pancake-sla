# Verify — Kiểm tra tính năng hoạt động đúng

Skill này verify tính năng vừa code bằng cách chạy TypeScript check, kiểm tra DB trực tiếp qua Prisma, và gọi API thực tế (nếu có session).

Tham số `$ARGUMENTS`: tính năng cần verify. Ví dụ: "sync", "dashboard", "sla config"

---

## Bước 1 — TypeScript check

```bash
npx tsc --noEmit
```

Nếu có lỗi: hiển thị lỗi, **dừng lại và sửa** trước khi verify tiếp.

---

## Bước 2 — Kiểm tra DB trực tiếp (luôn chạy)

Chạy lệnh sau để lấy snapshot DB hiện tại:

```bash
npx tsx -e "
import { prisma } from './lib/prisma.ts';
const [pages, convs, msgs, sla, lastSync] = await Promise.all([
  prisma.page.count(),
  prisma.conversation.count(),
  prisma.message.count(),
  prisma.sLAViolation.count(),
  prisma.syncHistory.findFirst({
    orderBy: { startedAt: 'desc' },
    select: { status: true, startedAt: true, completedAt: true, pagesCount: true, conversationsCount: true, messagesCount: true, errors: true }
  })
]);
console.log(JSON.stringify({ pages, convs, msgs, sla, lastSync }, null, 2));
await prisma.\$disconnect();
"
```

Kết quả cho biết:
- `pages > 0` → đã sync pages từ Pancake
- `convs > 0` → đã sync conversations
- `msgs > 0` → đã sync messages
- `sla > 0` → đã tính SLA
- `lastSync.status` → trạng thái sync gần nhất (`success | failed | running | cancelled`)

---

## Bước 3 — Verify theo tính năng (`$ARGUMENTS`)

### Nếu verify **sync** hoặc `$ARGUMENTS` trống:

Kiểm tra chi tiết sync history:

```bash
npx tsx -e "
import { prisma } from './lib/prisma.ts';
const history = await prisma.syncHistory.findMany({
  orderBy: { startedAt: 'desc' },
  take: 3,
  select: { id: true, status: true, startedAt: true, completedAt: true, pagesCount: true, conversationsCount: true, messagesCount: true, slaChecked: true, errors: true }
});
console.log(JSON.stringify(history, null, 2));
await prisma.\$disconnect();
"
```

Kiểm tra:
- `status === 'success'` và `conversationsCount > 0` → sync hoạt động đúng
- `errors` array rỗng → không có lỗi khi sync
- `completedAt` tồn tại → sync hoàn thành, không bị timeout

Nếu muốn test API sync thực tế (cần dev server đang chạy), thêm bước gọi endpoint:

```bash
curl -s -X POST http://localhost:4000/api/cron/sync \
  -H "Authorization: Bearer $(node -e "require('dotenv').config(); process.stdout.write(process.env.CRON_SECRET || '')")"
```

Quan sát response: `success: true` và `stats` có dữ liệu.

### Nếu verify **dashboard** hoặc **stats**:

```bash
npx tsx -e "
import { prisma } from './lib/prisma.ts';
const [totalPages, totalConvs, lateSLA, pendingSLA, slaSuccessRate] = await Promise.all([
  prisma.page.count({ where: { isActivated: true } }),
  prisma.conversation.count(),
  prisma.sLAViolation.count({ where: { isLateReply: true } }),
  prisma.sLAViolation.count({ where: { slaStatus: 'pending' } }),
  prisma.sLAViolation.aggregate({ _count: { id: true }, where: { isLateReply: false, responseTimeMinutes: { not: null } } })
]);
const total = await prisma.sLAViolation.count({ where: { responseTimeMinutes: { not: null } } });
console.log(JSON.stringify({
  totalPages, totalConvs, lateSLA, pendingSLA,
  slaSuccessRate: total > 0 ? ((slaSuccessRate._count.id / total) * 100).toFixed(1) + '%' : 'N/A'
}, null, 2));
await prisma.\$disconnect();
"
```

Kiểm tra: các con số hợp lý, `slaSuccessRate` có giá trị.

### Nếu verify **SLA config**:

```bash
npx tsx -e "
import { readFile } from 'fs/promises';
try {
  const raw = await readFile('./data/sla-config.json', 'utf-8');
  console.log(raw);
} catch {
  console.log('No custom config — using defaults: INBOX=15min, COMMENT=60min, Mon-Sat 08:00-18:00');
}
"
```

### Nếu verify **conversations** hoặc **filter**:

```bash
npx tsx -e "
import { prisma } from './lib/prisma.ts';
const sample = await prisma.sLAViolation.findMany({
  take: 3,
  orderBy: { customerMessageAt: 'desc' },
  select: { conversationId: true, slaStatus: true, responseTimeMinutes: true, effectiveResponseMinutes: true, outsideBusinessHours: true, conversationType: true, customerMessageAt: true }
});
console.log(JSON.stringify(sample, null, 2));
await prisma.\$disconnect();
"
```

Kiểm tra: records tồn tại, `slaStatus` có giá trị hợp lệ, `responseTimeMinutes` đúng kiểu.

---

## Bước 4 — Kiểm tra dev server (nếu cần)

```bash
# Kiểm tra server đang chạy
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/login
```

- `200` → server OK
- Không có kết nối → server chưa chạy, chạy `npm run dev`

Lưu ý: tất cả API routes đều yêu cầu auth. Dùng cron endpoint với CRON_SECRET để test sync qua HTTP (xem bước 3).

---

## Bước 5 — Báo kết quả

Tổng hợp theo format:

```
## Kết quả Verify — [tính năng]

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| TypeScript | ✅/❌ | ... |
| DB records | ✅/❌ | pages=X, convs=X, msgs=X, sla=X |
| Sync history | ✅/❌ | last: status=X, convs=X, errors=[] |
| [Tính năng cụ thể] | ✅/❌ | ... |
| Dev server | ✅/❌ | port 4000 |

**Tổng:** X/Y passed

[Mô tả vấn đề nếu có, kèm đề xuất fix]
```
