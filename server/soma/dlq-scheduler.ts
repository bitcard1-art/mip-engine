/**
 * DLQ 재시도 배치 스케줄러
 * WO-MIP-2026-002 §7.2
 * 5분 간격으로 DLQ에 저장된 미전송 이벤트 재전송 시도
 */
import { retryDlqEvents } from "./webhook-sender";

const DLQ_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5분

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startDlqRetryScheduler(): void {
  if (schedulerTimer) return; // 중복 시작 방지

  console.log("[DLQ Scheduler] 시작 — 5분 간격 재시도");

  schedulerTimer = setInterval(async () => {
    try {
      await retryDlqEvents();
    } catch (err) {
      console.error("[DLQ Scheduler] 재시도 오류:", err);
    }
  }, DLQ_RETRY_INTERVAL_MS);

  // 프로세스 종료 시 정리
  process.on("SIGTERM", stopDlqRetryScheduler);
  process.on("SIGINT", stopDlqRetryScheduler);
}

export function stopDlqRetryScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[DLQ Scheduler] 중지");
  }
}
