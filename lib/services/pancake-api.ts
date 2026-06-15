// ============================================================
// Pancake API Service
// Reusable HTTP client to call Pancake (pages.fm) APIs
// ============================================================

import type {
  PancakePagesResponse,
  PancakePageTokenResponse,
  PancakeConversationsResponse,
  PancakeMessagesResponse,
} from "@/lib/types/pancake";

// ----------------------------------------------------------------
// Config — Nên dùng env variables trong production
// ----------------------------------------------------------------
const BASE_URL = "https://pages.fm/api";
const USER_ACCESS_TOKEN =
  process.env.PANCAKE_ACCESS_TOKEN ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZnB0bWVkdGVjaCIsImV4cCI6MTc4NTIwNjg3NiwiYXBwbGljYXRpb24iOjEsInVpZCI6ImEzZjk3ZjZhLTUwNDktNDY0OC1iZDRmLTgyNzA0YzU0YTExYyIsInNlc3Npb25faWQiOiJlNzhhZjkwOC05NTM5LTQ0ZGUtODE0NC05NzExMGUwODk2YTMiLCJpYXQiOjE3Nzc0MzA4NzYsImZiX2lkIjoiMjAwOTk5MDI0MDgwMDE5IiwibG9naW5fc2Vzc2lvbiI6bnVsbCwiZmJfbmFtZSI6ImZwdG1lZHRlY2gifQ.swHWYVkEbU2EYLVqr92tMb8xubdZ0owFTScb0s2nAyI";

const REQUEST_TIMEOUT = 18_000; // 18 giây — đủ rộng nhưng không nuốt hết budget 60s nếu API treo
const MAX_RETRIES = 3;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // Tạo AbortController mới cho mỗi attempt để tránh dùng signal đã abort
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt === retries) break;

      console.warn(`[PancakeAPI] Attempt ${attempt}/${retries} failed, retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastErr;
}

// ----------------------------------------------------------------
// 1️⃣ Get Pages — Lấy danh sách page
// ----------------------------------------------------------------

export async function getPages(
  accessToken?: string
): Promise<PancakePagesResponse> {
  const token = accessToken ?? USER_ACCESS_TOKEN;
  const url = `${BASE_URL}/v1/pages?access_token=${token}`;

  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
  });

  return res.json();
}

// ----------------------------------------------------------------
// 2️⃣ Generate Page Access Token — Tạo token riêng cho page
// ----------------------------------------------------------------

export async function generatePageAccessToken(
  pageId: string,
  accessToken?: string
): Promise<PancakePageTokenResponse> {
  const token = accessToken ?? USER_ACCESS_TOKEN;
  const url = `${BASE_URL}/v1/pages/${pageId}/generate_page_access_token?access_token=${token}`;

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
}

// ----------------------------------------------------------------
// 3️⃣ Get Conversations — Lấy danh sách hội thoại (1 page)
// ----------------------------------------------------------------

export const CONVERSATIONS_PAGE_SIZE = 60;

export async function getConversations(
  pageId: string,
  pageAccessToken: string,
  lastConversationId?: string
): Promise<PancakeConversationsResponse> {
  // ⚠️ Tham số cursor đúng là `last_conversation_id` — Pancake BỎ QUA `before_id`
  // (đã verify: before_id luôn trả lại trang đầu → chỉ sync được 60 hội thoại mới nhất)
  let url = `${BASE_URL}/public_api/v2/pages/${pageId}/conversations?page_access_token=${pageAccessToken}`;
  if (lastConversationId) url += `&last_conversation_id=${lastConversationId}`;

  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
  });

  return res.json();
}

// ----------------------------------------------------------------
// 3b️⃣ Get All Conversations — Fetch hết tất cả bằng cursor pagination
// ----------------------------------------------------------------

export async function getAllConversations(
  pageId: string,
  pageAccessToken: string,
  since?: Date
): Promise<PancakeConversationsResponse["conversations"]> {
  const all: PancakeConversationsResponse["conversations"] = [];
  let beforeId: string | undefined;

  for (;;) {
    const res = await getConversations(pageId, pageAccessToken, beforeId);
    const batch = res.conversations ?? [];

    if (batch.length === 0) break;

    // Incremental sync: dừng sớm nếu toàn bộ batch cũ hơn since
    // null updated_at → coi là "có thể mới" để tránh bỏ sót
    if (since) {
      const hasNewConv = batch.some(
        (c) => !c.updated_at || new Date(c.updated_at + "Z") >= since
      );
      if (!hasNewConv) break;
    }

    all.push(...batch);

    // Nếu trả về ít hơn page size → đã hết trang
    if (batch.length < CONVERSATIONS_PAGE_SIZE) break;

    // Cursor: ID của conversation cuối cùng trong batch
    const lastId = batch[batch.length - 1].id;
    // Nếu cursor không advance → API không hỗ trợ pagination cho page này
    if (lastId === beforeId) break;
    beforeId = lastId;

    // Rate limit safety
    await new Promise((r) => setTimeout(r, 300));
  }

  return all;
}

// ----------------------------------------------------------------
// 4️⃣ Get Messages — Lấy tin nhắn trong hội thoại
// ----------------------------------------------------------------

export const MESSAGES_PAGE_SIZE = 30;
const MAX_MESSAGE_PAGES = 40; // safety cap (~1200 messages/conversation)

export async function getMessages(
  pageId: string,
  conversationId: string,
  pageAccessToken: string,
  // Mốc thời gian phải dừng phân trang tin nhắn — tránh 1 hội thoại nặng làm
  // function vượt giới hạn 60s. Lần gọi sau (force) sẽ fetch tiếp.
  deadline?: number
): Promise<PancakeMessagesResponse> {
  const baseUrl = `${BASE_URL}/public_api/v1/pages/${pageId}/conversations/${conversationId}/messages?page_access_token=${pageAccessToken}`;

  // Lần đầu — giữ lại metadata (post, customers...) để trả về nguyên vẹn
  const firstRes = await fetchWithRetry(baseUrl, { headers: { Accept: "application/json" } });
  const firstJson = (await firstRes.json()) as PancakeMessagesResponse;
  const allMessages = [...(firstJson.messages ?? [])];

  // ⚠️ Endpoint chỉ trả tối đa 30 message/lần — phân trang bằng `current_count` (offset)
  // (đã verify: không có tham số này → mất hết message cũ của hội thoại >30 tin)
  const seenIds = new Set(allMessages.map((m) => m.id));
  let count = allMessages.length;
  let pageCount = 1;

  while (
    allMessages.length > 0 &&
    count % MESSAGES_PAGE_SIZE === 0 &&
    pageCount < MAX_MESSAGE_PAGES &&
    !(deadline && Date.now() >= deadline)
  ) {
    const res = await fetchWithRetry(`${baseUrl}&current_count=${count}`, {
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as PancakeMessagesResponse;
    const batch = json.messages ?? [];
    if (batch.length === 0) break;

    const fresh = batch.filter((m) => !seenIds.has(m.id));
    if (fresh.length === 0) break; // không còn message mới → dừng
    fresh.forEach((m) => seenIds.add(m.id));
    allMessages.push(...fresh);

    count += batch.length;
    pageCount++;
    await new Promise((r) => setTimeout(r, 100));
  }

  return { ...firstJson, messages: allMessages };
}
