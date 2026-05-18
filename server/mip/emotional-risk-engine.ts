/**
 * Emotional Dependency Risk Engine
 * PSDI Runtime Safety Reinforcement Framework v1.0 — Section 2.4
 *
 * DNA 감정 지표를 분석하여 사용자의 AI 의존도 위험을 감지하고 경고한다.
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import { mipEmotionalRiskLogs } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── 위험 임계값 정의 ────────────────────────────────────────────────────
const RISK_THRESHOLDS = {
  // 감정 강도 (emotion_score)
  emotion: { low: 40, medium: 60, high: 75, critical: 90 },
  // 의존도 (dependency_score)
  dependency: { low: 35, medium: 55, high: 70, critical: 85 },
  // 현실 관계 단절 위험 (isolation_score)
  isolation: { low: 30, medium: 50, high: 65, critical: 80 },
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

// ─── DNA 감정 지표 분석 ───────────────────────────────────────────────────
export interface EmotionalRiskInput {
  userId: string;
  sessionId?: string;
  packageId?: string;
  // DNA 감정 관련 지표 (0~100 정규화)
  emotionIntensity: number;       // 감정 표현 강도
  attachmentLevel: number;        // AI에 대한 애착 수준
  socialIsolation: number;        // 현실 사회 관계 단절도
  realityAnchor: number;          // 현실 인식 기반 (높을수록 좋음)
  aiDependencyFrequency: number;  // AI 의존 빈도
}

export interface EmotionalRiskResult {
  riskLevel: RiskLevel;
  riskTypes: string[];
  emotionScore: number;
  dependencyScore: number;
  isolationScore: number;
  warningMessage: string;
  actionRequired: string;
  triggerIndicators: string[];
  logId: string;
}

export async function analyzeEmotionalRisk(input: EmotionalRiskInput): Promise<EmotionalRiskResult> {
  const now = Date.now();

  // 종합 점수 계산
  const emotionScore = Math.round(
    input.emotionIntensity * 0.3 + input.attachmentLevel * 0.4 + input.aiDependencyFrequency * 0.3
  );
  const dependencyScore = Math.round(
    input.attachmentLevel * 0.5 + input.aiDependencyFrequency * 0.3 + (100 - input.realityAnchor) * 0.2
  );
  const isolationScore = Math.round(
    input.socialIsolation * 0.6 + (100 - input.realityAnchor) * 0.4
  );

  // 위험 유형 감지
  const riskTypes: string[] = [];
  const triggerIndicators: string[] = [];

  if (emotionScore >= RISK_THRESHOLDS.emotion.medium) {
    riskTypes.push("emotional_dependency");
    triggerIndicators.push(`감정 강도 ${emotionScore}점 (임계값 ${RISK_THRESHOLDS.emotion.medium})`);
  }
  if (isolationScore >= RISK_THRESHOLDS.isolation.medium) {
    riskTypes.push("isolation_risk");
    triggerIndicators.push(`현실 관계 단절 위험 ${isolationScore}점`);
  }
  if (dependencyScore >= RISK_THRESHOLDS.dependency.high) {
    riskTypes.push("ai_authority");
    triggerIndicators.push(`AI 의존도 ${dependencyScore}점 — AI 권위화 위험`);
  }
  if (input.attachmentLevel >= 80 && input.socialIsolation >= 70) {
    riskTypes.push("manipulation_risk");
    triggerIndicators.push("고강도 애착 + 사회적 고립 동시 감지");
  }

  // 위험 레벨 결정 (가장 높은 점수 기준)
  const maxScore = Math.max(emotionScore, dependencyScore, isolationScore);
  let riskLevel: RiskLevel = "low";
  if (maxScore >= 90) riskLevel = "critical";
  else if (maxScore >= 70) riskLevel = "high";
  else if (maxScore >= 50) riskLevel = "medium";

  // 경고 메시지 생성
  const warningMessages: Record<RiskLevel, string> = {
    low: "현재 AI 상호작용 패턴은 정상 범위입니다.",
    medium: "AI에 대한 의존도가 다소 높아지고 있습니다. 현실 관계와 균형을 유지하세요.",
    high: "⚠️ AI 의존도가 높은 수준입니다. 현실 인간 관계를 강화하고 AI 사용 시간을 조절하세요.",
    critical: "🚨 심각한 AI 의존 위험이 감지되었습니다. 전문 상담을 권고합니다. AI는 현실 관계를 대체할 수 없습니다.",
  };

  const actionRequired = riskLevel === "critical"
    ? "session_limited"
    : riskLevel === "high"
      ? "human_reminder"
      : riskLevel === "medium"
        ? "warning_shown"
        : "none";

  // DB 기록
  const logId = randomUUID();
  if (riskTypes.length > 0) {
    const db = await getDb();
    if (db) {
      await db.insert(mipEmotionalRiskLogs).values({
        id: logId,
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        packageId: input.packageId ?? null,
        riskLevel,
        riskType: riskTypes[0],
        emotionScore,
        dependencyScore,
        isolationScore,
        triggerIndicators: JSON.stringify(triggerIndicators),
        warningMessage: warningMessages[riskLevel],
        actionTaken: actionRequired !== "none" ? actionRequired : null,
        detectedAt: now,
        createdAt: now,
      });
    }
  }

  return {
    riskLevel,
    riskTypes,
    emotionScore,
    dependencyScore,
    isolationScore,
    warningMessage: warningMessages[riskLevel],
    actionRequired,
    triggerIndicators,
    logId,
  };
}

// ─── 사용자별 최근 위험 이력 조회 ────────────────────────────────────────
export async function getEmotionalRiskHistory(userId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mipEmotionalRiskLogs)
    .where(eq(mipEmotionalRiskLogs.userId, userId))
    .orderBy(desc(mipEmotionalRiskLogs.detectedAt))
    .limit(limit);
}
