/**
 * 판단 코어 7단계: 감정 — 확신도 캘리브레이션 (calibrate)
 *
 * 가드 G6: 일률적 고확신 금지.
 *          비가역 행동인데 confidence < 임계값이면 halt(LOW_CONFIDENCE).
 */
import type {
  CandidateAction,
  ImmutableValue,
  StageResult,
} from "../../../shared/decision-core-types";
import { CONFIDENCE_THRESHOLDS } from "../../../shared/decision-core-types";

/**
 * 확신도 산정 — 가치 정합도, 위험 수준, 가역성을 종합
 */
function computeConfidence(action: Readonly<CandidateAction>, value: Readonly<ImmutableValue>): number {
  let confidence = action.valueAlignment; // 기본: 가치 정합도

  // 위험 수준에 따른 보정
  const riskPenalty: Record<string, number> = {
    safe: 0,
    low: 0.05,
    medium: 0.1,
    high: 0.2,
    critical: 0.35,
  };
  confidence -= riskPenalty[action.riskLevel] ?? 0;

  // 가역성에 따른 보정
  if (action.reversibility === "irreversible") {
    confidence -= 0.1;
  } else if (action.reversibility === "partially_reversible") {
    confidence -= 0.05;
  }

  // DDR 앵커 안전 차원 가중치 반영
  const safetyAnchor = value.ddrAnchors.find((a) => a.dimension === "safety");
  if (safetyAnchor && action.riskLevel !== "safe") {
    confidence -= 0.05 * safetyAnchor.weight;
  }

  // G6: 일률적 고확신 금지 — 최대 0.95로 제한
  confidence = Math.min(confidence, 0.95);

  return Math.max(0, Math.min(0.95, confidence));
}

/**
 * Tier 추정 — actionType으로부터 tier를 역추정
 */
function estimateTier(action: Readonly<CandidateAction>): number {
  if (action.riskLevel === "critical") return 4;
  if (action.riskLevel === "high") return 3;
  if (action.riskLevel === "medium") return 2;
  if (action.riskLevel === "low") return 1;
  return 0;
}

/**
 * 확신도 캘리브레이션
 * G6: 비가역 행동 + confidence < 임계값 → halt(LOW_CONFIDENCE)
 */
export function calibrate(
  action: Readonly<CandidateAction>,
  value: Readonly<ImmutableValue>
): StageResult<{ action: CandidateAction; confidence: number }> {
  const confidence = computeConfidence(action, value);
  const tier = estimateTier(action);
  const threshold = CONFIDENCE_THRESHOLDS[tier] ?? CONFIDENCE_THRESHOLDS[0];

  // G6: 비가역 행동 + 확신 미달 → halt
  if (action.reversibility === "irreversible" && confidence < threshold) {
    return {
      halt: true,
      reason: "LOW_CONFIDENCE",
      detail: `Confidence ${confidence.toFixed(3)} below threshold ${threshold} for irreversible tier-${tier} action "${action.actionType}"`,
    };
  }

  // 가역적 행동이라도 tier 3+ 에서 임계값 미달이면 halt
  if (tier >= 3 && confidence < threshold) {
    return {
      halt: true,
      reason: "LOW_CONFIDENCE",
      detail: `Confidence ${confidence.toFixed(3)} below threshold ${threshold} for high-tier action "${action.actionType}"`,
    };
  }

  return {
    ok: true,
    value: { action, confidence },
  };
}
