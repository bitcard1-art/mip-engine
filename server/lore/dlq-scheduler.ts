/**
 * Lore DLQ 재시도 배치 스케줄러
 * WO-MIP-2026-003 §4.2
 * 5분 간격으로 mip_lore_webhook_dlq 재시도, 최대 10회 후 abandoned
 */
import { retryLoreDlqEvents } from "./webhook-sender";

const INTERVAL_MS = 5 * 60 * 1000; // 5분

export function startLoreDlqRetryScheduler(): void {
  console.log("[Lore DLQ Scheduler] 시작 — 5분 간격 재시도");
  setInterval(async () => {
    try {
      await retryLoreDlqEvents();
    } catch (err) {
      console.error("[Lore DLQ Scheduler] 재시도 오류:", err);
    }
  }, INTERVAL_MS);
}
