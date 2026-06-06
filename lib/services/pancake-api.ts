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

const REQUEST_TIMEOUT = 30_000; // 30 giây
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
  beforeId?: string
): Promise<PancakeConversationsResponse> {
  let url = `${BASE_URL}/public_api/v2/pages/${pageId}/conversations?page_access_token=${pageAccessToken}`;
  if (beforeId) url += `&before_id=${beforeId}`;

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
        (c) => !c.updated_at || new Date(c.updated_at + "+07:00") >= since
      );
      if (!hasNewConv) break;
    }

    all.push(...batch);

    // Nếu trả về ít hơn page size → đã hết trang
    if (batch.length < CONVERSATIONS_PAGE_SIZE) break;

    // Cursor: ID của conversation cuối cùng trong batch
    beforeId = batch[batch.length - 1].id;

    // Rate limit safety
    await new Promise((r) => setTimeout(r, 300));
  }

  return all;
}

// ----------------------------------------------------------------
// 4️⃣ Get Messages — Lấy tin nhắn trong hội thoại
// ----------------------------------------------------------------

export async function getMessages(
  pageId: string,
  conversationId: string,
  pageAccessToken: string
): Promise<PancakeMessagesResponse> {
  const url = `${BASE_URL}/public_api/v1/pages/${pageId}/conversations/${conversationId}/messages?page_access_token=${pageAccessToken}`;

  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
  });

  return res.json();
}
