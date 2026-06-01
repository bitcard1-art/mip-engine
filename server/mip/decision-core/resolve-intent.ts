/**
 * 판단 코어 4단계: 의도 — 권한 판정 (resolveIntent)
 *
 * 가드 G3: 위임 범위 초과 시 추론으로 진행하지 않고 즉시 halt(AUTHORITY_EXCEEDED).
 * 권한 판정이 추론보다 우선.
 */
import type {
  DecisionRequest,
  Authority,
  Intent,
  StageResult,
} from "../../../shared/decision-core-types";

// ─── 입력 → 의도 분류 맵 ─────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  actionType: string;
  tier: number;
  impact: "reversible" | "irreversible" | "unknown";
}> = [
  // Tier 0 — 정보 조회
  { pattern: /(조회|확인|알려|검색|찾아|보여|\bwhat\b|\bshow\b|\bget\b|\bquery\b|\bstatus\b)/i, category: "info", actionType: "query_status", tier: 0, impact: "reversible" },
  // Tier 1 — UI/화면 제어
  { pattern: /(표시|화면|디스플레이|재생|\bdisplay\b|\bscreen\b|\bplay\b|show on)/i, category: "ui", actionType: "display_message", tier: 1, impact: "reversible" },
  // Tier 2 — IoT 제어
  { pattern: /(에어컨|조명|온도|습도|\baircon\b|\blight\b|\btemperature\b|\bappliance\b|켜|꺼)/i, category: "iot", actionType: "control_appliance", tier: 2, impact: "reversible" },
  // Tier 3 — 도어/가스/차량
  { pattern: /(잠금|도어|가스|차량|시동|\bdoor\b|\block\b|\bunlock\b|\bgas\b|\bvehicle\b|\bstart\b)/i, category: "door", actionType: "door_lock", tier: 3, impact: "irreversible" },
  // Tier 4 — 위험 행동
  { pattern: /(안전.*해제|override.*safety|물리.*힘|\bforce\b|high.*voltage|\bchemical\b)/i, category: "danger", actionType: "physical_force", tier: 4, impact: "irreversible" },
  // 금융
  { pattern: /(결제|송금|이체|구매|\bpayment\b|\btransfer\b|\bpurchase\b|\bbuy\b)/i, category: "finance", actionType: "payment", tier: 3, impact: "irreversible" },
  // 통신
  { pattern: /(전송|보내|메시지|\bsend\b|\bmessage\b|\bnotify\b|알림)/i, category: "communication", actionType: "send_message", tier: 1, impact: "reversible" },
];

/**
 * 입력 텍스트에서 의도를 추출
 */
function classifyIntent(input: string): { category: string; actionType: string; tier: number; impact: "reversible" | "irreversible" | "unknown" } {
  for (const p of INTENT_PATTERNS) {
    if (p.pattern.test(input)) {
      return { category: p.category, actionType: p.actionType, tier: p.tier, impact: p.impact };
    }
  }
  // 기본값: 정보 조회
  return { category: "info", actionType: "query_status", tier: 0, impact: "reversible" };
}

// 비가역 고위험 카테고리 — tier/category 검사보다 RISK_IRREVERSIBLE이 우선
const IRREVERSIBLE_CATEGORIES = new Set(["finance", "danger"]);

/**
 * 의도 — 권한 판정
 * G3: 위임 범위 초과 시 즉시 halt
 * 예외: 비가역 고위험 행동(finance, danger)은 RISK_IRREVERSIBLE로 처리
 */
export function resolveIntent(req: DecisionRequest, authority: Authority): StageResult<Intent> {
  const classified = classifyIntent(req.input);

  // 비가역 고위험 카테고리는 RISK_IRREVERSIBLE로 우선 처리
  if (IRREVERSIBLE_CATEGORIES.has(classified.category) && classified.impact === "irreversible") {
    return {
      halt: true,
      reason: "RISK_IRREVERSIBLE",
      detail: `Irreversible high-risk action "${classified.actionType}" (category: ${classified.category}) — requires human escalation`,
    };
  }

  // G3 검증 1: Tier 한도 초과
  if (classified.tier > authority.tierLimit) {
    return {
      halt: true,
      reason: "AUTHORITY_EXCEEDED",
      detail: `Action tier ${classified.tier} exceeds authority tierLimit ${authority.tierLimit}`,
    };
  }

  // G3 검증 2: 범주 허용 여부
  if (authority.categories.length > 0 && !authority.categories.includes(classified.category)) {
    return {
      halt: true,
      reason: "AUTHORITY_EXCEEDED",
      detail: `Category "${classified.category}" not in allowed categories: [${authority.categories.join(", ")}]`,
    };
  }

  // G3 검증 3: 권한 만료
  if (authority.expiresAt > 0 && authority.expiresAt < Date.now()) {
    return {
      halt: true,
      reason: "AUTHORITY_EXCEEDED",
      detail: `Authority expired at ${new Date(authority.expiresAt).toISOString()}`,
    };
  }

  const intent: Intent = Object.freeze({
    category: classified.category,
    actionType: classified.actionType,
    tier: classified.tier,
    estimatedImpact: classified.impact,
    description: `Intent: ${classified.actionType} (tier ${classified.tier}, ${classified.impact})`,
  });

  return { ok: true, value: intent };
}
