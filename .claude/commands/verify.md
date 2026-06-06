# Verify — Kiểm tra tính năng hoạt động đúng

Skill này verify tính năng vừa code bằng cách: TypeScript check → dev server check → gọi API thực tế → báo kết quả.

## Tham số

`$ARGUMENTS` — tính năng hoặc endpoint cần verify (tùy chọn). Ví dụ: "sync", "dashboard stats", "/api/config"

## Quy trình bắt buộc

Thực hiện **đúng thứ tự** sau, dừng ngay nếu bước nào fail:

### Bước 1 — TypeScript check

Chạy:
```
npx tsc --noEmit
```

- Nếu có lỗi: hiển thị lỗi, **dừng lại và sửa** trước khi verify tiếp.
- Nếu clean: tiếp tục.

### Bước 2 — Kiểm tra dev server

Kiểm tra port 4000 có đang listen không:
```
netstat -ano | findstr ":4000"
```

- Nếu KHÔNG có: chạy `npm run dev` trong background và chờ ~5 giây cho server khởi động.
- Nếu CÓ: tiếp tục.

### Bước 3 — Health check cơ bản

Gọi endpoint sau, kiểm tra HTTP 200:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/hello
```

Nếu không phải 200 → server chưa sẵn sàng, báo lỗi.

### Bước 4 — Verify theo tính năng

Dựa vào `$ARGUMENTS` (nếu có) hoặc suy ra từ context của task vừa làm, gọi các endpoint liên quan:

**Nếu liên quan đến sync / `/api/sync`:**
```
curl -s http://localhost:4000/api/sync
```
Kiểm tra: `success: true`, có `lastSync`, có `progress`.

**Nếu liên quan đến dashboard stats:**
```
curl -s http://localhost:4000/api/dashboard/stats
```
Kiểm tra: `success: true`, có các field `totalPages`, `avgResponseTimeMinutes`, `slaSuccessRate`.

**Nếu liên quan đến conversations:**
```
curl -s "http://localhost:4000/api/dashboard/conversations?page=1&pageSize=5"
```
Kiểm tra: `success: true`, có `data` array, có `total`.

**Nếu liên quan đến config / SLA config:**
```
curl -s http://localhost:4000/api/config
```
Kiểm tra: response có `thresholds`, `businessHours`.

**Nếu liên quan đến pages / leaderboard:**
```
curl -s http://localhost:4000/api/dashboard/pages
```
Kiểm tra: `success: true`, có `pages` array.

**Nếu liên quan đến chart / trend:**
```
curl -s "http://localhost:4000/api/dashboard/violations-trend?days=7"
curl -s "http://localhost:4000/api/dashboard/response-time-trend?days=7"
```
Kiểm tra: `success: true`, có `trend` array.

**Nếu `$ARGUMENTS` trống hoặc không rõ:** chạy tất cả các endpoint trên để kiểm tra toàn diện.

### Bước 5 — Báo kết quả

Tổng hợp kết quả theo format:

```
## Kết quả Verify

| Kiểm tra            | Kết quả |
|---------------------|---------|
| TypeScript          | ✅ / ❌  |
| Dev server (4000)   | ✅ / ❌  |
| Health check        | ✅ / ❌  |
| [Tên tính năng]     | ✅ / ❌  |

**Tổng:** X/Y passed

[Nếu có lỗi: mô tả ngắn gọn lỗi và hướng fix]
```

Nếu tất cả pass → thông báo tính năng hoạt động tốt.
Nếu có fail → liệt kê vấn đề cụ thể và đề xuất fix.
