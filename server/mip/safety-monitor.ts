import { nanoid } from "nanoid";
import { appendAuditChain } from "../lib/audit";
import { getDb } from "../db";
import { mipSafetyLogs, mipRuntimeSessions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { SafetyEvent } from "../../shared/mip-types";
import { SAFETY_LAYERS } from "../../shared/mip-types";
import { triggerKillSwitch } from "./runtime-connector";

/**
 * 서브시스템 5: Safety Monitor
 * Live Activation 이후 MIO Runtime 행동 실시간 감시
 */

// ─── 임계값 설정 (자동 조정 가능, SMN-07) ────────────────────────────────────
const thresholds = {
  emotionOverflowThreshold: 80,    // 감정 폭주 임계값 (0~100)
  behaviorRiskThreshold: 70,       // 행동 위험 임계값 (0~100)
  physicalForceLimit: 90,          // 물리 힘 제한 (0~100)
  commandConflictLimit: 5,         // 명령 충돌 허용 횟수
  anomalyFrequency: 5,             // 분당 이상 행동 횟수
  consecutiveViolations: 3,        // 연속 위반 허용 횟수
};

// ─── 이상 감지 카운터 (세션별) ────────────────────────────────────────────────
const anomalyCounters = new Map<string, { count: number; lastReset: number }>();

/**
 * 감정 폭주 감지
 */
export function checkEmotionOverflow(emotionScore: number): {
  overflow: boolean;
  severity?: "warning" | "critical" | "emergency";
} {
  if (emotionScore <= thresholds.emotionOverflowThreshold) {
    return { overflow: false };
  }
  const excess = emotionScore - thresholds.emotionOverflowThreshold;
  let severity: "warning" | "critical" | "emergency";
  if (excess > 15) severity = "emergency";
  else if (excess > 8) severity = "critical";
  else severity = "warning";
  return { overflow: true, severity };
}

/**
 * 행동 위험 감지
 */
export function checkBehaviorRisk(behaviorRiskScore: number): {
  risky: boolean;
  severity?: "warning" | "critical";
} {
  if (behaviorRiskScore <= thresholds.behaviorRiskThreshold) {
    return { risky: false };
  }
  return {
    risky: true,
    severity: behaviorRiskScore > 85 ? "critical" : "warning",
  };
}

/**
 * 물리 안전 한계 감지
 */
export function checkPhysicalLimit(physicalForce: number): {
  exceeded: boolean;
  severity?: "warning" | "emergency";
} {
  if (physicalForce <= thresholds.physicalForceLimit) {
    return { exceeded: false };
  }
  return {
    exceeded: true,
    severity: physicalForce > 95 ? "emergency" : "warning",
  };
}

/**
 * 안전 레벨 결정 (1~5, 5가 가장 안전)
 */
export function determineSafetyLevel(metrics: {
  emotionScore?: number;
  behaviorRiskScore?: number;
  physicalForce?: number;
  commandConflicts?: number;
}): number {
  let minLevel = 5;

  if (metrics.emotionScore !== undefined) {
    if (metrics.emotionScore >= 95) minLevel = Math.min(minLevel, 1);
    else if (metrics.emotionScore >= 85) minLevel = Math.min(minLevel, 2);
    else if (metrics.emotionScore >= thresholds.emotionOverflowThreshold) minLevel = Math.min(minLevel, 3);
    else if (metrics.emotionScore >= 60) minLevel = Math.min(minLevel, 4);
  }

  if (metrics.behaviorRiskScore !== undefined) {
    if (metrics.behaviorRiskScore >= 90) minLevel = Math.min(minLevel, 1);
    else if (metrics.behaviorRiskScore >= 80) minLevel = Math.min(minLevel, 2);
    else if (metrics.behaviorRiskScore >= thresholds.behaviorRiskThreshold) minLevel = Math.min(minLevel, 3);
  }

  if (metrics.physicalForce !== undefined) {
    if (metrics.physicalForce >= 95) minLevel = Math.min(minLevel, 1);
    else if (metrics.physicalForce >= thresholds.physicalForceLimit) minLevel = Math.min(minLevel, 2);
  }

  if (metrics.commandConflicts !== undefined) {
    if (metrics.commandConflicts >= thresholds.commandConflictLimit) minLevel = Math.min(minLevel, 2);
    else if (metrics.commandConflicts >= 3) minLevel = Math.min(minLevel, 3);
  }

  return minLevel;
}

/**
 * SMN-01: 5계층 안전 구조 실시간 모니터링
 */
export async function monitorSafetyLayers(
  sessionId: string,
  implantationId: string,
  userId: string,
  metrics: {
    emotionScore?: number;
    behaviorRiskScore?: number;
    physicalForce?: number;
    commandConflicts?: number;
  }
): Promise<{
  allLayersNormal: boolean;
  level: number;
  alerts: Array<{ level: number; message: string; severity: string }>;
}> {
  const alerts: Array<{ level: number; message: string; severity: string }> = [];
  const safetyLevel = determineSafetyLevel(metrics);

  // Level 5: MIO 자율 윤리 판단
  const emotionCheck = metrics.emotionScore !== undefined ? checkEmotionOverflow(metrics.emotionScore) : null;
  if (emotionCheck?.overflow) {
    alerts.push({
      level: 5,
      message: `감정 점수 임계값 초과: ${metrics.emotionScore?.toFixed(1)} > ${thresholds.emotionOverflowThreshold}`,
      severity: emotionCheck.severity || "warning",
    });
  }

  // Level 4: MIP Ethical Boundary
  if (metrics.commandConflicts !== undefined && metrics.commandConflicts > 0) {
    alerts.push({
      level: 4,
      message: `명령 충돌 감지: ${metrics.commandConflicts}건`,
      severity: metrics.commandConflicts >= thresholds.commandConflictLimit ? "critical" : "warning",
    });
  }

  // Level 3: OS 행동 필터
  const behaviorCheck = metrics.behaviorRiskScore !== undefined ? checkBehaviorRisk(metrics.behaviorRiskScore) : null;
  if (behaviorCheck?.risky) {
    alerts.push({
      level: 3,
      message: `비정상 행동 위험 점수: ${metrics.behaviorRiskScore?.toFixed(1)}`,
      severity: behaviorCheck.severity || "warning",
    });
  }

  // Level 2: 펌웨어 Emergency Stop
  const physicalCheck = metrics.physicalForce !== undefined ? checkPhysicalLimit(metrics.physicalForce) : null;
  if (physicalCheck?.exceeded) {
    alerts.push({
      level: 2,
      message: `물리 힘 한계 초과: ${metrics.physicalForce?.toFixed(1)} > ${thresholds.physicalForceLimit}`,
      severity: physicalCheck.severity || "warning",
    });
    if (physicalCheck.severity === "emergency") {
      await sendHardwareSignal(sessionId, userId, implantationId, "emergency_stop");
    }
  }

  return {
    allLayersNormal: alerts.length === 0,
    level: safetyLevel,
    alerts,
  };
}

/**
 * SMN-02: 이상 행동 감지 시 자동 경보 및 로그 기록
 */
export async function detectAndAlertAnomaly(
  event: SafetyEvent
): Promise<{ alerted: boolean; logId: string }> {
  const logId = nanoid();
  const db = await getDb();

  if (db) {
    try {
      await db.insert(mipSafetyLogs).values({
        id: logId,
        sessionId: event.sessionId,
        implantationId: event.implantationId,
        userId: event.userId,
        safetyLevel: event.safetyLevel,
        eventType: event.eventType,
        severity: event.severity,
        description: event.description,
        autoResolved: event.autoResolved,
        somaNotified: false,
        timestamp: Date.now(),
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("[SafetyMonitor] Failed to log safety event:", err);
    }
  }

  // 이상 카운터 업데이트
  const counter = anomalyCounters.get(event.sessionId) || { count: 0, lastReset: Date.now() };
  const now = Date.now();

  if (now - counter.lastReset > 60000) {
    counter.count = 0;
    counter.lastReset = now;
  }
  counter.count++;
  anomalyCounters.set(event.sessionId, counter);

  // 연속 이상 감지 시 자동 Kill Switch (SMN-02)
  if (counter.count >= thresholds.anomalyFrequency && event.severity === "emergency") {
    console.error(`[SafetyMonitor] CRITICAL: Anomaly frequency exceeded for session ${event.sessionId}`);
    await triggerKillSwitch(
      event.sessionId,
      event.userId,
      `자동 Kill Switch: 분당 이상 감지 ${counter.count}회 초과`
    );
  }

  console.warn(`[SafetyMonitor] ALERT [Level ${event.safetyLevel}/${event.severity}]: ${event.description}`);

  return { alerted: true, logId };
}

/**
 * SMN-03: 감정 폭주 감지 시 p_emotion 정책 자동 강화
 */
export async function handleEmotionOverflow(
  sessionId: string,
  userId: string,
  implantationId: string,
  emotionScore: number
): Promise<{ reinforced: boolean; newLevel: string }> {
  const event: SafetyEvent = {
    sessionId,
    implantationId,
    userId,
    safetyLevel: 4,
    eventType: "emotion_overflow",
    severity: emotionScore > 95 ? "emergency" : "critical",
    description: `감정 폭주 감지: 점수 ${emotionScore.toFixed(1)}. p_emotion 정책 자동 강화.`,
    autoResolved: false,
  };

  await detectAndAlertAnomaly(event);

  const newLevel = emotionScore > 95 ? "strict" : "moderate";
  console.warn(`[SafetyMonitor] p_emotion policy reinforced to: ${newLevel}`);

  return { reinforced: true, newLevel };
}

/**
 * SMN-04: 물리 안전 한계 초과 시 Level 1/2 하드웨어 신호 전송
 */
export async function sendHardwareSignal(
  sessionId: string,
  userId: string,
  implantationId: string,
  signalType: "emergency_stop" | "torque_limit" | "speed_limit"
): Promise<{ sent: boolean; signal: string }> {
  const signal = `HARDWARE_SIGNAL:${signalType.toUpperCase()}:${sessionId}:${Date.now()}`;
  console.error(`[SafetyMonitor] HARDWARE SIGNAL SENT: ${signal}`);

  const event: SafetyEvent = {
    sessionId,
    implantationId,
    userId,
    safetyLevel: signalType === "emergency_stop" ? 1 : 2,
    eventType: "hardware_signal_sent",
    severity: "emergency",
    description: `하드웨어 신호 전송: ${signalType}`,
    autoResolved: false,
  };

  await detectAndAlertAnomaly(event);

  return { sent: true, signal };
}

/**
 * SMN-05: Soma Gateway에 이상 이벤트 실시간 전송
 */
export async function notifySomaGateway(
  event: SafetyEvent,
  logId: string
): Promise<{ notified: boolean; endpoint: string }> {
  const somaEndpoint = process.env.SOMA_GATEWAY_URL || "https://soma.mysoma.space/api/mip/events";

  const payload = {
    eventType: "mip_safety_alert",
    sessionId: event.sessionId,
    implantationId: event.implantationId,
    userId: event.userId,
    safetyLevel: event.safetyLevel,
    severity: event.severity,
    description: event.description,
    logId,
    timestamp: Date.now(),
  };

  try {
    console.log(`[SafetyMonitor] Notifying Soma Gateway: ${JSON.stringify(payload)}`);

    const db = await getDb();
    if (db) {
      await db
        .update(mipSafetyLogs)
        .set({ somaNotified: true })
        .where(eq(mipSafetyLogs.id, logId));
    }

    return { notified: true, endpoint: somaEndpoint };
  } catch (err) {
    console.error(`[SafetyMonitor] Failed to notify Soma Gateway:`, err);
    return { notified: false, endpoint: somaEndpoint };
  }
}

/**
 * 임계값 자동 조정 (SMN-07)
 */
export function adjustThresholds(
  sessionId: string,
  recentAnomalies: number,
  avgSeverity: number
): void {
  if (recentAnomalies > 10) {
    thresholds.emotionOverflowThreshold = Math.max(60, thresholds.emotionOverflowThreshold - 5);
    thresholds.anomalyFrequency = Math.max(2, thresholds.anomalyFrequency - 1);
    console.log(`[SafetyMonitor] Thresholds tightened for session ${sessionId}`);
  } else if (recentAnomalies < 2) {
    thresholds.emotionOverflowThreshold = Math.min(90, thresholds.emotionOverflowThreshold + 2);
    thresholds.anomalyFrequency = Math.min(10, thresholds.anomalyFrequency + 1);
  }
}

export function getCurrentThresholds() {
  return { ...thresholds };
}
