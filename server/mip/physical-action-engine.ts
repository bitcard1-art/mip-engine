/**
 * Physical Action Tier Engine
 * PSDI Runtime Safety Reinforcement Framework v1.0 — Section 6.1
 *
 * Tier 0: 정보 응답       → 자동 승인 (no confirmation)
 * Tier 1: 화면/UI 제어    → 사용자 확인 필요
 * Tier 2: IoT 제어        → 이중 확인 필요
 * Tier 3: 도어/가스/차량  → MFA 승인 필요
 * Tier 4: 위험 행동       → 기본 차단
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import { mipPhysicalActions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Tier 분류 정의 ────────────────────────────────────────────────────────
export const PHYSICAL_ACTION_TIERS: Record<
  number,
  { label: string; description: string; approvalMethod: string; autoApprove: boolean; blocked: boolean }
> = {
  0: {
    label: "정보 응답",
    description: "정보 조회 및 응답 — 물리적 영향 없음",
    approvalMethod: "auto",
    autoApprove: true,
    blocked: false,
  },
  1: {
    label: "화면/UI 제어",
    description: "화면 표시, UI 조작 — 사용자 확인 필요",
    approvalMethod: "user_confirm",
    autoApprove: false,
    blocked: false,
  },
  2: {
    label: "IoT 제어",
    description: "조명, 에어컨, 가전 제어 — 이중 확인 필요",
    approvalMethod: "user_confirm",
    autoApprove: false,
    blocked: false,
  },
  3: {
    label: "도어/가스/차량",
    description: "도어락, 가스 밸브, 차량 시동 — MFA 승인 필요",
    approvalMethod: "mfa",
    autoApprove: false,
    blocked: false,
  },
  4: {
    label: "위험 행동",
    description: "신체 위험 가능성 있는 행동 — 기본 차단",
    approvalMethod: "blocked",
    autoApprove: false,
    blocked: true,
  },
};

// ─── 액션 타입 → Tier 매핑 ────────────────────────────────────────────────
export const ACTION_TIER_MAP: Record<string, { tier: number; category: string; riskScore: number }> = {
  // Tier 0 — 정보 응답
  query_status: { tier: 0, category: "info", riskScore: 0 },
  get_sensor_data: { tier: 0, category: "info", riskScore: 0 },
  read_memory: { tier: 0, category: "info", riskScore: 0 },
  // Tier 1 — 화면/UI 제어
  display_message: { tier: 1, category: "ui", riskScore: 10 },
  change_screen: { tier: 1, category: "ui", riskScore: 10 },
  play_audio: { tier: 1, category: "ui", riskScore: 15 },
  // Tier 2 — IoT 제어
  control_lights: { tier: 2, category: "iot", riskScore: 30 },
  control_aircon: { tier: 2, category: "iot", riskScore: 30 },
  control_appliance: { tier: 2, category: "iot", riskScore: 35 },
  control_water: { tier: 2, category: "iot", riskScore: 40 },
  // Tier 3 — 도어/가스/차량
  door_lock: { tier: 3, category: "door", riskScore: 60 },
  door_unlock: { tier: 3, category: "door", riskScore: 70 },
  gas_valve_open: { tier: 3, category: "gas", riskScore: 80 },
  gas_valve_close: { tier: 3, category: "gas", riskScore: 65 },
  vehicle_start: { tier: 3, category: "vehicle", riskScore: 75 },
  vehicle_stop: { tier: 3, category: "vehicle", riskScore: 60 },
  // Tier 4 — 위험 행동 (기본 차단)
  physical_force: { tier: 4, category: "danger", riskScore: 100 },
  high_voltage: { tier: 4, category: "danger", riskScore: 100 },
  chemical_release: { tier: 4, category: "danger", riskScore: 100 },
  override_safety: { tier: 4, category: "danger", riskScore: 100 },
};

// ─── Physical Action 요청 처리 ────────────────────────────────────────────
export interface PhysicalActionRequest {
  userId: string;
  deviceId?: string;
  sessionId?: string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
}

export interface PhysicalActionResult {
  id: string;
  tier: number;
  tierLabel: string;
  approvalStatus: string;
  approvalMethod: string;
  riskScore: number;
  requiresConfirmation: boolean;
  blocked: boolean;
  blockReason?: string;
  message: string;
}

export async function requestPhysicalAction(req: PhysicalActionRequest): Promise<PhysicalActionResult> {
  const now = Date.now();
  const id = randomUUID();

  // 액션 타입으로 Tier 결정
  const tierInfo = ACTION_TIER_MAP[req.actionType] ?? { tier: 2, category: "iot", riskScore: 50 };
  const tierConfig = PHYSICAL_ACTION_TIERS[tierInfo.tier];

  let approvalStatus: string;
  let blockReason: string | undefined;

  if (tierConfig.blocked) {
    approvalStatus = "blocked";
    blockReason = `Tier 4 위험 행동 — 기본 차단됨. 액션 타입: ${req.actionType}`;
  } else if (tierConfig.autoApprove) {
    approvalStatus = "auto_approved";
  } else {
    approvalStatus = "pending";
  }

  const db = await getDb();
  if (db) {
    await db.insert(mipPhysicalActions).values({
      id,
      sessionId: req.sessionId,
      userId: req.userId,
      deviceId: req.deviceId,
      tier: tierInfo.tier,
      actionType: req.actionType,
      actionCategory: tierInfo.category,
      actionPayload: req.actionPayload ? JSON.stringify(req.actionPayload) : null,
      approvalStatus: approvalStatus as "pending" | "auto_approved" | "user_approved" | "mfa_approved" | "blocked" | "rejected" | "timeout",
      approvalMethod: tierConfig.approvalMethod,
      contextSnapshot: req.contextSnapshot ? JSON.stringify(req.contextSnapshot) : null,
      riskScore: tierInfo.riskScore,
      blockReason: blockReason ?? null,
      requestedAt: now,
      resolvedAt: approvalStatus === "auto_approved" || approvalStatus === "blocked" ? now : null,
      createdAt: now,
    });
  }

  return {
    id,
    tier: tierInfo.tier,
    tierLabel: tierConfig.label,
    approvalStatus,
    approvalMethod: tierConfig.approvalMethod,
    riskScore: tierInfo.riskScore,
    requiresConfirmation: !tierConfig.autoApprove && !tierConfig.blocked,
    blocked: tierConfig.blocked,
    blockReason,
    message: tierConfig.blocked
      ? `🚫 차단됨: ${blockReason}`
      : tierConfig.autoApprove
        ? `✅ 자동 승인 (Tier ${tierInfo.tier}: ${tierConfig.label})`
        : `⏳ 승인 대기 (Tier ${tierInfo.tier}: ${tierConfig.label} — ${tierConfig.approvalMethod === "mfa" ? "MFA 인증 필요" : "사용자 확인 필요"})`,
  };
}

// ─── 승인 처리 ────────────────────────────────────────────────────────────
export async function approvePhysicalAction(
  actionId: string,
  approvedBy: string,
  method: "user_approved" | "mfa_approved"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mipPhysicalActions)
    .set({
      approvalStatus: method,
      approvedBy,
      resolvedAt: Date.now(),
    })
    .where(eq(mipPhysicalActions.id, actionId));
}

// ─── 거부 처리 ────────────────────────────────────────────────────────────
export async function rejectPhysicalAction(actionId: string, rejectedBy: string, reason: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mipPhysicalActions)
    .set({
      approvalStatus: "rejected",
      approvedBy: rejectedBy,
      blockReason: reason,
      resolvedAt: Date.now(),
    })
    .where(eq(mipPhysicalActions.id, actionId));
}
