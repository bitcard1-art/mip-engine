/**
 * §14.2.5 Emotional Bridge Engine
 * PSDI v2.0 §14.2.5 "Bounded Permeable Isolation" 구현
 *
 * 인간이 업무 스트레스 속에서도 가족·반려동물·휴식을 통해 감정 회복을 경험하듯,
 * MIP Runtime도 분리된 자아(Runtime)가 중심 존재(Core Identity)를 공유하며
 * 선택적으로 정서적·맥락적 영향을 주고받을 수 있어야 한다.
 *
 * 4가지 채널:
 *  - emotional_bridge : 감정 회복 신호 전달 (Emotional Recovery)
 *  - context_relay    : 안전한 맥락 전달 (Safe Context Transfer)
 *  - memory_sync      : 승인 기반 기억 동기화 (Approval-based Memory Sync)
 *  - trust_channel    : 검증된 영향 교환 (Verified Influence Exchange)
 */

import { nanoid } from "nanoid";
import { sha256Hash } from "../lib/hmac";
import { appendAuditChain } from "../lib/audit";
import { getDb } from "../db";
import {
  mipEmotionalBridgeEvents,
  type InsertMipEmotionalBridgeEvent,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── 채널별 신뢰 임계값 ───────────────────────────────────────────────────────

const TRUST_THRESHOLDS = {
  emotional_bridge: 30,  // 낮은 임계값 — 감정 회복은 쉽게 허용
  context_relay: 50,     // 중간 — 맥락 전달은 검증 필요
  memory_sync: 70,       // 높음 — 기억 동기화는 엄격한 승인 필요
  trust_channel: 80,     // 최고 — 검증된 영향만 허용
} as const;

// ─── 신호 강도 계산 ───────────────────────────────────────────────────────────

function calculateSignalStrength(
  bridgeType: InsertMipEmotionalBridgeEvent["bridgeType"],
  payload: Record<string, unknown>
): number {
  switch (bridgeType) {
    case "emotional_bridge": {
      // 감정 회복 신호: 긍정 감정 지표 기반
      const positiveEmotions = ["joy", "calm", "trust", "relief", "comfort"];
      const count = positiveEmotions.filter((e) => payload[e] !== undefined).length;
      return Math.min(100, count * 20 + 10);
    }
    case "context_relay": {
      // 맥락 전달: 맥락 항목 수 기반
      return Math.min(100, Object.keys(payload).length * 15);
    }
    case "memory_sync": {
      // 기억 동기화: 기억 항목 수 기반 (보수적)
      const memoryCount = Array.isArray(payload.memories)
        ? (payload.memories as unknown[]).length
        : 0;
      return Math.min(100, memoryCount * 10);
    }
    case "trust_channel": {
      // 신뢰 채널: 검증 서명 존재 여부
      return payload.signature ? 80 : 40;
    }
    default:
      return 50;
  }
}

// ─── Trust Score 계산 ─────────────────────────────────────────────────────────

function calculateTrustScore(
  bridgeType: InsertMipEmotionalBridgeEvent["bridgeType"],
  payload: Record<string, unknown>,
  sessionContext?: { isolationActive?: boolean; trustLevel?: number }
): number {
  let base = 50;

  // Isolation Layer 활성 여부
  if (sessionContext?.isolationActive) base += 20;

  // 세션 신뢰 레벨
  if (sessionContext?.trustLevel) {
    base += sessionContext.trustLevel * 5;
  }

  // 채널별 추가 점수
  switch (bridgeType) {
    case "emotional_bridge":
      base += 10; // 감정 회복은 기본적으로 신뢰
      break;
    case "trust_channel":
      // 서명 검증
      if (payload.signature) {
        const expectedSig = sha256Hash(JSON.stringify(payload.content ?? ""));
        if (payload.signature === expectedSig) base += 30;
      }
      break;
    case "memory_sync":
      // 명시적 승인 필요
      if (!payload.userApproved) base -= 30;
      break;
  }

  return Math.max(0, Math.min(100, base));
}

// ─── §14.2.5 Emotional Bridge 신호 전송 ──────────────────────────────────────

export interface EmotionalBridgeInput {
  sessionId: string;
  implantationId: string;
  userId: string;
  bridgeType: InsertMipEmotionalBridgeEvent["bridgeType"];
  signalPayload: Record<string, unknown>;
  sessionContext?: {
    isolationActive?: boolean;
    trustLevel?: number;
  };
}

export interface EmotionalBridgeResult {
  eventId: string;
  accepted: boolean;
  trustScore: number;
  signalStrength: number;
  rejectionReason?: string;
  // §14.2.5 Bounded Permeable 결과
  permeableResult: {
    channelType: string;
    threshold: number;
    passed: boolean;
    message: string;
  };
}

/**
 * §14.2.5 Emotional Bridge 신호 처리
 * "안전한 경계 위의 안정적 공존" — 검증된 신호만 Core Identity에 전달
 */
export async function processEmotionalBridge(
  input: EmotionalBridgeInput
): Promise<EmotionalBridgeResult> {
  const now = Date.now();
  const id = nanoid();

  const signalStrength = calculateSignalStrength(input.bridgeType, input.signalPayload);
  const trustScore = calculateTrustScore(
    input.bridgeType,
    input.signalPayload,
    input.sessionContext
  );

  const threshold = TRUST_THRESHOLDS[input.bridgeType];
  const passed = trustScore >= threshold;

  let rejectionReason: string | undefined;
  if (!passed) {
    rejectionReason = `Trust score ${trustScore} below threshold ${threshold} for ${input.bridgeType}`;
  }

  // memory_sync는 명시적 사용자 승인 필수
  const requiresApproval = input.bridgeType === "memory_sync";
  const userApproved = input.signalPayload.userApproved === true;
  const finalAccepted = passed && (!requiresApproval || userApproved);

  if (requiresApproval && !userApproved && passed) {
    rejectionReason = "§14.2.5 Memory Sync requires explicit user approval";
  }

  const db = await getDb();
  if (db) {
    const record: InsertMipEmotionalBridgeEvent = {
      id,
      sessionId: input.sessionId,
      implantationId: input.implantationId,
      userId: input.userId,
      bridgeType: input.bridgeType,
      signalPayload: JSON.stringify(input.signalPayload),
      signalStrength,
      trustScore,
      verified: passed ? 1 : 0,
      verifiedAt: passed ? now : undefined,
      accepted: finalAccepted ? 1 : 0,
      rejectionReason,
      processedAt: now,
      createdAt: now,
    };
    await db.insert(mipEmotionalBridgeEvents).values(record);

    await appendAuditChain({
      entityType: "session",
      entityId: input.sessionId,
      action: `emotional_bridge_${finalAccepted ? "accepted" : "rejected"}`,
      actorId: input.userId,
      data: {
        eventId: id,
        bridgeType: input.bridgeType,
        trustScore,
        signalStrength,
        accepted: finalAccepted,
      },
    });
  }

  return {
    eventId: id,
    accepted: finalAccepted,
    trustScore,
    signalStrength,
    rejectionReason,
    permeableResult: {
      channelType: input.bridgeType,
      threshold,
      passed: finalAccepted,
      message: finalAccepted
        ? `§14.2.5 ${input.bridgeType} signal accepted — Bounded Permeable Isolation passed`
        : `§14.2.5 ${input.bridgeType} signal rejected — ${rejectionReason}`,
    },
  };
}

// ─── Emotional Bridge 이력 조회 ───────────────────────────────────────────────

export async function getEmotionalBridgeEvents(
  implantationId: string,
  limit = 20
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mipEmotionalBridgeEvents)
    .where(eq(mipEmotionalBridgeEvents.implantationId, implantationId))
    .orderBy(desc(mipEmotionalBridgeEvents.createdAt))
    .limit(limit);
}

/**
 * §14.2.5 Homeostasis 상태 계산
 * 최근 Emotional Bridge 이벤트를 기반으로 감정 항상성 점수 계산
 */
export async function calculateHomeostasisScore(
  implantationId: string
): Promise<{
  score: number;        // 0~100
  status: "stable" | "recovering" | "unstable";
  recentEvents: number;
  acceptanceRate: number;
}> {
  const events = await getEmotionalBridgeEvents(implantationId, 10);
  if (events.length === 0) {
    return { score: 50, status: "stable", recentEvents: 0, acceptanceRate: 0 };
  }

  const accepted = events.filter((e) => e.accepted === 1).length;
  const acceptanceRate = Math.round((accepted / events.length) * 100);

  const avgTrust =
    events.reduce((sum, e) => sum + (e.trustScore ?? 0), 0) / events.length;
  const avgStrength =
    events.reduce((sum, e) => sum + (e.signalStrength ?? 0), 0) / events.length;

  const score = Math.round(avgTrust * 0.6 + avgStrength * 0.4);

  const status =
    score >= 70 ? "stable" : score >= 40 ? "recovering" : "unstable";

  return { score, status, recentEvents: events.length, acceptanceRate };
}
