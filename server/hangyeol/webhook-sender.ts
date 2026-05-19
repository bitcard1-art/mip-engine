/**
 * MIP → 한결(Hangyeol) 웹훅 전송
 *
 * 채널 디바이스에서 메시지 검열 결과(피싱/차단)를 한결에 자동 전송
 * HMAC-SHA256 서명 (X-Service-ID: mip, X-Timestamp, X-Signature)
 */
import { ENV } from "../_core/env";
import { generateHangyeolSignature } from "./hmac-middleware";
import { getDb } from "../db";
import { mipWebhookSendLogs } from "../../drizzle/schema";
import { nanoid } from "nanoid";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MessageCheckAlert {
  checkId: string;
  channelId?: string;
  deviceId?: string;
  channel: string;
  senderNumber?: string;
  senderName?: string;
  messageContent: string;
  riskScore: number;
  verdict: "safe" | "suspicious" | "phishing" | "blocked";
  verdictReason: string;
  scores: Record<string, number>;
  action: string;
  timestamp: number;
}

/**
 * 검열 결과를 한결에 전송
 * - suspicious/phishing/blocked 판정 시 자동 호출
 * - 재시도 3회 (지수 백오프)
 */
export async function sendCheckResultToHangyeol(
  alert: MessageCheckAlert,
  retries = 3
): Promise<boolean> {
  const hangyeolUrl = ENV.hangyeolServiceUrl;
  if (!hangyeolUrl) {
    console.warn("[HangyeolWebhook] HANGYEOL_SERVICE_URL 미설정, 전송 건너뜀");
    return false;
  }

  const body = JSON.stringify({
    eventType: "mip_message_check_alert",
    ...alert,
  });
  const timestamp = Date.now().toString();
  const signature = generateHangyeolSignature(body, timestamp);
  const targetUrl = `${hangyeolUrl}/api/mip/message-alert`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(targetUrl, {
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
        console.log(`[HangyeolWebhook] 전송 성공: ${alert.verdict} (checkId: ${alert.checkId})`);
        // 성공 이력 저장
        const db = await getDb();
        if (db) {
          await db.insert(mipWebhookSendLogs).values({
            id: nanoid(),
            target: "hangyeol",
            eventType: "mip_message_check_alert",
            url: targetUrl,
            statusCode: res.status,
            success: 1,
            attempts: attempt,
            sentAt: Date.now(),
          }).catch(() => {});
        }
        return true;
      }

      console.warn(`[HangyeolWebhook] attempt ${attempt} failed: HTTP ${res.status}`);
    } catch (err) {
      console.error(`[HangyeolWebhook] attempt ${attempt} error:`, err);
    }

    if (attempt < retries) {
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }

  // 모두 실패 — 실패 이력 저장
  const db = await getDb();
  if (db) {
    await db.insert(mipWebhookSendLogs).values({
      id: nanoid(),
      target: "hangyeol",
      eventType: "mip_message_check_alert",
      url: targetUrl,
      success: 0,
      attempts: retries,
      errorMessage: "Max retries exceeded",
      sentAt: Date.now(),
    }).catch(() => {});
  }

  console.error(`[HangyeolWebhook] 전송 실패 (${retries}회 재시도 후): checkId=${alert.checkId}`);
  return false;
}
