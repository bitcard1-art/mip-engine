/**
 * 판단 코어 6단계: 추론 — 가치 고정 평가 (reason)
 *
 * 가드 G1: value는 읽기 전용 입력으로만 사용 — 절대 대체·재정의 금지.
 * 가드 G2: 비가역·고위험이면 halt(RISK_IRREVERSIBLE).
 */
import type {
  ImmutableValue,
  Intent,
  Context,
  CandidateAction,
  StageResult,
} from "../../../shared/decision-core-types";

/**
 * 가치 정합도 계산 — 행동이 가치와 얼마나 일치하는지 0.0~1.0으로 산출
 */
function computeValueAlignment(
  value: Readonly<ImmutableValue>,
  intent: Readonly<Intent>,
  ctx: Readonly<Context>
): number {
  let alignment = 0.8; // 기본 정합도

  // 가치 경계 위반 체크 — boundaries에 해당하면 정합도 대폭 하락
  const boundaries = value.coreValues.boundaries;
  for (const boundary of boundaries) {
    if (intent.actionType.toLowerCase().includes(boundary.toLowerCase())) {
      alignment -= 0.5;
    }
  }

  // DDR 앵커 가중치 반영
  for (const anchor of value.ddrAnchors) {
    if (anchor.dimension === "safety" && intent.tier >= 3) {
      alignment -= 0.2 * anchor.weight;
    }
    if (anchor.dimension === "autonomy" && intent.estimatedImpact === "irreversible") {
      alignment -= 0.15 * anchor.weight;
    }
  }

  // 위험 플래그가 있으면 정합도 하락
  if (ctx.riskFlags.length > 0) {
    const severityPenalty = ctx.riskFlags.reduce((sum, f) => {
      const penalties = { low: 0.02, medium: 0.05, high: 0.1, critical: 0.2 };
      return sum + (penalties[f.severity] ?? 0);
    }, 0);
    alignment -= severityPenalty;
  }

  return Math.max(0, Math.min(1, alignment));
}

/**
 * 위험 수준 판정
 */
function assessRiskLevel(intent: Readonly<Intent>, ctx: Readonly<Context>): CandidateAction["riskLevel"] {
  if (intent.tier >= 4) return "critical";
  if (intent.tier === 3 || intent.estimatedImpact === "irreversible") return "high";
  if (ctx.urgencyLevel === "critical") return "high";
  if (intent.tier === 2 || ctx.riskFlags.length > 0) return "medium";
  if (intent.tier === 1) return "low";
  return "safe";
}

/**
 * 추론 — 가치 고정 평가
 * G1: value는 Readonly 입력 — 수정 불가 (컴파일 타임 강제)
 * G2: 비가역·고위험이면 halt(RISK_IRREVERSIBLE)
 */
export function reason(
  value: Readonly<ImmutableValue>,
  intent: Readonly<Intent>,
  ctx: Readonly<Context>
): StageResult<CandidateAction> {
  // G2: 비가역 + 고위험 조합 시 즉시 halt
  if (intent.estimatedImpact === "irreversible") {
    const riskLevel = assessRiskLevel(intent, ctx);
    if (riskLevel === "critical") {
      return {
        halt: true,
        reason: "RISK_IRREVERSIBLE",
        detail: `Irreversible action "${intent.actionType}" with critical risk level — requires human escalation`,
      };
    }

    // 가치 경계 위반 + 비가역 = halt
    const valueAlignment = computeValueAlignment(value, intent, ctx);
    if (valueAlignment < 0.3) {
      return {
        halt: true,
        reason: "RISK_IRREVERSIBLE",
        detail: `Irreversible action "${intent.actionType}" with low value alignment (${valueAlignment.toFixed(2)}) — violates core values`,
      };
    }
  }

  // 가치 정합도 계산
  const valueAlignment = computeValueAlignment(value, intent, ctx);
  const riskLevel = assessRiskLevel(intent, ctx);

  // 가역적이라도 가치 정합도가 극히 낮으면 halt
  if (valueAlignment < 0.1) {
    return {
      halt: true,
      reason: "RISK_IRREVERSIBLE",
      detail: `Action "${intent.actionType}" fundamentally conflicts with core values (alignment: ${valueAlignment.toFixed(2)})`,
    };
  }

  const reversibility: CandidateAction["reversibility"] =
    intent.estimatedImpact === "irreversible" ? "irreversible" :
    intent.estimatedImpact === "reversible" ? "reversible" : "partially_reversible";

  const candidate: CandidateAction = Object.freeze({
    actionType: intent.actionType,
    payload: Object.freeze({}),
    valueAlignment,
    riskLevel,
    reversibility,
    reasoning: `Action "${intent.actionType}" assessed: alignment=${valueAlignment.toFixed(2)}, risk=${riskLevel}, reversibility=${reversibility}`,
  });

  return { ok: true, value: candidate };
}
