/**
 * MIP → Lore 공통 Webhook 발신 함수
 * WO-MIP-2026-003 §4.1
 * - 재시도 3회 (지수 백오프: 1s, 2s, 4s)
 * - 3회 실패 시 mip_lore_webhook_dlq 저장
 * - DLQ 배치 재시도 최대 10회 후 abandoned
 */
import { nanoid } from "nanoid";
import { ENV } from "../_core/env";
import { generateLoreSignature } from "./hmac-middleware";
import { getDb } from "../db";
import { mipLoreWebhookDlq, mipWebhookSendLogs } from "../../drizzle/schema";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveToDLQ(eventType: string, payload: object): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[LoreWebhook] DLQ 저장 실패: DB 연결 없음");
    return;
  }
  await db.insert(mipLoreWebhookDlq).values({
    id: nanoid(),
    eventType,
    payload: JSON.stringify(payload),
    attempts: 3,
    lastAttemptAt: Date.now(),
    failedAt: Date.now(),
    status: "pending",
  });
  console.warn(`[LoreWebhook] DLQ 저장 완료: ${eventType}`);
}

/**
 * Lore로 Webhook 이벤트 전송
 * @param eventType 이벤트 타입 (예: 'mip_package_received')
 * @param payload 전송할 페이로드 객체
 * @param retries 재시도 횟수 (기본 3)
 */
export async function sendLoreWebhook(
  eventType: string,
  payload: object,
  retries = 3
): Promise<void> {
  const loreUrl = ENV.loreWebhookUrl;
  if (!loreUrl) {
    console.warn("[LoreWebhook] LORE_WEBHOOK_URL 미설정, 전송 건너뜀");
    return;
  }

  const body = JSON.stringify({ eventType, ...payload });
  const timestamp = Date.now().toString();
  const signature = generateLoreSignature(body, timestamp);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${loreUrl}/api/mip/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-ID": "mip",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000), // 10초 타임아웃
      });

      if (res.ok) {
        console.log(`[LoreWebhook] 전송 성공: ${eventType} (attempt ${attempt})`);
        // 성공 이력 저장
        const db = await getDb();
        if (db) {
          await db.insert(mipWebhookSendLogs).values({
            id: nanoid(),
            target: "lore",
            eventType,
            url: `${loreUrl}/api/mip/webhook`,
            statusCode: res.status,
            success: 1,
            attempts: attempt,
            sentAt: Date.now(),
          }).catch(() => {});
        }
        return;
      }
      console.warn(
        `[LoreWebhook] attempt ${attempt} failed: HTTP ${res.status} ${eventType}`
      );
    } catch (err) {
      console.error(`[LoreWebhook] attempt ${attempt} error:`, err);
    }

    // 지수 백오프 (1s, 2s, 4s)
    if (attempt < retries) {
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }

  // 3회 모두 실패 → DLQ 저장 + 실패 이력 저장
  await saveToDLQ(eventType, payload);
  const db = await getDb();
  if (db) {
    await db.insert(mipWebhookSendLogs).values({
      id: nanoid(),
      target: "lore",
      eventType,
      url: `${loreUrl}/api/mip/webhook`,
      success: 0,
      attempts: retries,
      errorMessage: "Max retries exceeded",
      sentAt: Date.now(),
    }).catch(() => {});
  }
}

/**
 * Lore REST API 직접 호출 (Package 갱신 요청 등)
 * @param path Lore API 경로 (예: '/api/mip/package-refresh')
 * @param body 요청 바디 객체
 */
export async function callLoreApi(
  path: string,
  body: object
): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const loreUrl = ENV.loreServiceUrl;
  if (!loreUrl) {
    console.warn("[LoreApi] LORE_SERVICE_URL 미설정");
    return { ok: false, status: 0 };
  }

  const bodyStr = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = generateLoreSignature(bodyStr, timestamp);

  try {
    const res = await fetch(`${loreUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-ID": "mip",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(15_000),
    });

    const data = res.ok ? await res.json().catch(() => undefined) : undefined;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`[LoreApi] 호출 실패: ${path}`, err);
    return { ok: false, status: 0 };
  }
}

/**
 * Lore DLQ에 저장된 미전송 이벤트 재시도 (배치 작업용)
 * 5분 간격으로 호출, 최대 10회 후 abandoned
 */
export async function retryLoreDlqEvents(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { eq } = await import("drizzle-orm");

  const pendingItems = await db
    .select()
    .from(mipLoreWebhookDlq)
    .where(eq(mipLoreWebhookDlq.status, "pending"))
    .limit(20);

  for (const item of pendingItems) {
    if ((item.attempts ?? 0) >= 10) {
      await db
        .update(mipLoreWebhookDlq)
        .set({ status: "abandoned" })
        .where(eq(mipLoreWebhookDlq.id, item.id));
      continue;
    }

    let payload: object;
    try {
      payload = JSON.parse(item.payload);
    } catch {
      continue;
    }

    const body = JSON.stringify({ eventType: item.eventType, ...payload });
    const timestamp = Date.now().toString();
    const signature = generateLoreSignature(body, timestamp);

    try {
      const res = await fetch(`${ENV.loreWebhookUrl}/api/mip/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-ID": "mip",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await db
          .update(mipLoreWebhookDlq)
          .set({ status: "resolved", resolvedAt: Date.now() })
          .where(eq(mipLoreWebhookDlq.id, item.id));
        console.log(`[LoreDLQ] 재전송 성공: ${item.eventType} (id: ${item.id})`);
      } else {
        await db
          .update(mipLoreWebhookDlq)
          .set({ attempts: (item.attempts ?? 0) + 1, lastAttemptAt: Date.now() })
          .where(eq(mipLoreWebhookDlq.id, item.id));
      }
    } catch (err) {
      await db
        .update(mipLoreWebhookDlq)
        .set({ attempts: (item.attempts ?? 0) + 1, lastAttemptAt: Date.now() })
        .where(eq(mipLoreWebhookDlq.id, item.id));
      console.error(`[LoreDLQ] 재전송 실패: ${item.eventType}`, err);
    }
  }
}
