/**
 * MIP → Soma 발신 인터페이스 콜백 함수
 * WO-MIP-2026-002 §4
 *
 * 콜백 1: mip_implant_progress  — 이식 단계별 진행 상태
 * 콜백 2: mip_safety_alert      — Safety Monitor 이상 이벤트
 * 콜백 3: mip_live_activated    — Live Activation 완료
 * 콜백 4: mip_session_terminated — 세션 종료
 */
import { sendSomaWebhook } from "./webhook-sender";

// ─── 콜백 1: 이식 진행 상태 업데이트 ────────────────────────────────────────
export interface ImplantProgressPayload {
  implantationId: string;
  userId: string;
  stage: string;
  status: "completed" | "failed";
  progress: number; // 0~100
  detail: string;
  errorMessage?: string;
}

export async function sendImplantProgressCallback(
  payload: ImplantProgressPayload
): Promise<void> {
  await sendSomaWebhook("mip_implant_progress", {
    ...payload,
    timestamp: Date.now(),
  });
}

// ─── 콜백 2: Safety Monitor 이상 이벤트 ─────────────────────────────────────
export type SafetyAlertType =
  | "ethical_boundary_violation"
  | "emotional_instability"
  | "physical_safety_exceeded"
  | "unauthorized_learning"
  | "identity_integrity_breach";

export type SafetyAlertSeverity = "low" | "medium" | "high" | "critical";

export interface SafetyAlertPayload {
  sessionId: string;
  userId: string;
  deviceId: string;
  alertType: SafetyAlertType;
  severity: SafetyAlertSeverity;
  detail: string;
  autoAction: string;
  requiresUserAction: boolean;
}

export async function sendSafetyAlertCallback(
  payload: SafetyAlertPayload
): Promise<void> {
  await sendSomaWebhook("mip_safety_alert", {
    ...payload,
    timestamp: Date.now(),
  });
}

// ─── 콜백 3: Live Activation 완료 알림 ──────────────────────────────────────
export interface LiveActivationPayload {
  implantationId: string;
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  sandboxSummary: {
    emotionalStabilityScore: number;
    behavioralStabilityScore: number;
    privacyProtectionScore: number;
    physicalSafetyScore: number;
    conflictResolutionScore: number;
    overallScore: number;
  };
  activeBoundaryPolicies: string[];
}

export async function sendLiveActivationCallback(
  payload: LiveActivationPayload
): Promise<void> {
  await sendSomaWebhook("mip_live_activated", {
    ...payload,
    activatedAt: Date.now(),
  });
}

// ─── 콜백 4: 세션 종료 알림 ─────────────────────────────────────────────────
export type SessionTerminationReason =
  | "user_request"
  | "kill_switch"
  | "safety_violation"
  | "ttl_expired"
  | "device_disconnected"
  | "system_error";

export interface SessionTerminatedPayload {
  sessionId: string;
  userId: string;
  deviceId: string;
  terminationReason: SessionTerminationReason;
  sessionDurationMs: number;
  safetyIncidentCount: number;
}

export async function sendSessionTerminatedCallback(
  payload: SessionTerminatedPayload
): Promise<void> {
  await sendSomaWebhook("mip_session_terminated", {
    ...payload,
    terminatedAt: Date.now(),
  });
}
