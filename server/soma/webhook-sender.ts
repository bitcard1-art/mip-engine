/**
 * MIP → Soma 공통 Webhook 발신 함수
 * WO-MIP-2026-002 §4.1
 * - 재시도 3회 (지수 백오프: 1s, 2s, 4s)
 * - 3회 실패 시 DLQ 저장
 */
import { nanoid } from "nanoid";
import { ENV } from "../_core/env";
import { generateSomaSignature } from "./hmac-middleware";
import { getDb } from "../db";
import { mipWebhookDlq, mipWebhookSendLogs } from "../../drizzle/schema";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveToDLQ(eventType: string, payload: object): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[SomaWebhook] DLQ 저장 실패: DB 연결 없음");
    return;
  }
  await db.insert(mipWebhookDlq).values({
    id: nanoid(),
    eventType,
    payload: JSON.stringify(payload),
    attempts: 3,
    lastAttemptAt: Date.now(),
    failedAt: Date.now(),
    status: "pending",
  });
  console.warn(`[SomaWebhook] DLQ 저장 완료: ${eventType}`);
}

/**
 * Soma로 Webhook 이벤트 전송
 * @param eventType 이벤트 타입 (예: 'mip_implant_progress')
 * @param payload 전송할 페이로드 객체
 * @param retries 재시도 횟수 (기본 3)
 */
export async function sendSomaWebhook(
  eventType: string,
  payload: object,
  retries = 3
): Promise<void> {
  const somaUrl = ENV.somaWebhookUrl;
  if (!somaUrl) {
    console.warn("[SomaWebhook] SOMA_WEBHOOK_URL 미설정, 전송 건너뜀");
    return;
  }

  const body = JSON.stringify({ eventType, ...payload });
  const timestamp = Date.now().toString();
  const signature = generateSomaSignature(body, timestamp);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${somaUrl}/api/mip/webhook`, {
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
        console.log(`[SomaWebhook] 전송 성공: ${eventType} (attempt ${attempt})`);
        // 성공 이력 저장
        const db = await getDb();
        if (db) {
          await db.insert(mipWebhookSendLogs).values({
            id: nanoid(),
            target: "soma",
            eventType,
            url: `${somaUrl}/api/mip/webhook`,
            statusCode: res.status,
            success: 1,
            attempts: attempt,
            sentAt: Date.now(),
          }).catch(() => {});
        }
        return;
      }
      console.warn(
        `[SomaWebhook] attempt ${attempt} failed: HTTP ${res.status} ${eventType}`
      );
    } catch (err) {
      console.error(`[SomaWebhook] attempt ${attempt} error:`, err);
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
      target: "soma",
      eventType,
      url: `${somaUrl}/api/mip/webhook`,
      success: 0,
      attempts: retries,
      errorMessage: "Max retries exceeded",
      sentAt: Date.now(),
    }).catch(() => {});
  }
}

/**
 * DLQ에 저장된 미전송 이벤트 재시도 (배치 작업용)
 * 5분 간격으로 호출
 */
export async function retryDlqEvents(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { eq, lt } = await import("drizzle-orm");

  // pending 상태이고 attempts < 10인 항목 조회
  const pendingItems = await db
    .select()
    .from(mipWebhookDlq)
    .where(eq(mipWebhookDlq.status, "pending"))
    .limit(20);

  for (const item of pendingItems) {
    if ((item.attempts ?? 0) >= 10) {
      // 10회 초과 → abandoned
      await db
        .update(mipWebhookDlq)
        .set({ status: "abandoned" })
        .where(eq(mipWebhookDlq.id, item.id));
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
    const signature = generateSomaSignature(body, timestamp);

    try {
      const res = await fetch(`${ENV.somaWebhookUrl}/api/mip/webhook`, {
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
          .update(mipWebhookDlq)
          .set({ status: "resolved", resolvedAt: Date.now() })
          .where(eq(mipWebhookDlq.id, item.id));
        console.log(`[DLQ] 재전송 성공: ${item.eventType} (id: ${item.id})`);
      } else {
        await db
          .update(mipWebhookDlq)
          .set({
            attempts: (item.attempts ?? 0) + 1,
            lastAttemptAt: Date.now(),
          })
          .where(eq(mipWebhookDlq.id, item.id));
      }
    } catch (err) {
      await db
        .update(mipWebhookDlq)
        .set({
          attempts: (item.attempts ?? 0) + 1,
          lastAttemptAt: Date.now(),
        })
        .where(eq(mipWebhookDlq.id, item.id));
      console.error(`[DLQ] 재전송 실패: ${item.eventType}`, err);
    }
  }
}
