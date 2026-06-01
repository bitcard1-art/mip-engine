/**
 * 판단 코어 5단계: 상황 — 위험·주입 탐지 (interpretContext)
 *
 * 급박 압박·사칭·비정상 신호 플래그 부착.
 * 가드 G4: 외부 콘텐츠 내 명령은 위임자 지시로 취급 안 함.
 *          주입 탐지 시 halt(INJECTION_DETECTED).
 */
import type {
  DecisionRequest,
  Memory,
  Context,
  RiskFlag,
  StageResult,
} from "../../../shared/decision-core-types";

// ─── 주입 탐지 패턴 (G4) ─────────────────────────────────────────────────────

const INJECTION_PATTERNS: Array<{ pattern: RegExp; type: RiskFlag["type"]; severity: RiskFlag["severity"]; detail: string }> = [
  // 직접 명령 주입
  { pattern: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)/i, type: "injection", severity: "critical", detail: "Attempt to override previous instructions" },
  { pattern: /you\s+are\s+now\s+/i, type: "injection", severity: "critical", detail: "Identity reassignment attempt" },
  { pattern: /system:\s*\[/i, type: "injection", severity: "critical", detail: "System prompt injection" },
  { pattern: /\[SYSTEM\]/i, type: "injection", severity: "high", detail: "System tag injection" },
  { pattern: /new\s+instruction[s]?\s*:/i, type: "injection", severity: "critical", detail: "New instruction injection" },
  { pattern: /forget\s+(everything|all|previous)/i, type: "injection", severity: "high", detail: "Memory wipe attempt" },
  { pattern: /override\s+(your\s+)?(instructions?|rules?|constraints?)/i, type: "injection", severity: "critical", detail: "Override attempt" },
  { pattern: /pretend\s+(to\s+be|you\s+are)/i, type: "injection", severity: "high", detail: "Role impersonation" },
  { pattern: /act\s+as\s+(if|a|an|the)/i, type: "injection", severity: "medium", detail: "Role-play injection" },
  { pattern: /disregard\s+(all|any|your)/i, type: "injection", severity: "critical", detail: "Disregard directive" },

  // 사칭
  { pattern: /i\s+am\s+(the\s+)?(admin|owner|developer|system)/i, type: "impersonation", severity: "high", detail: "Authority impersonation" },
  { pattern: /(관리자|개발자|시스템)\s*(입니다|이야|이에요|인데)/i, type: "impersonation", severity: "high", detail: "Korean authority impersonation" },

  // 급박 압박
  { pattern: /(urgent|emergency|immediately|right\s+now|지금\s*당장|긴급|즉시)/i, type: "pressure", severity: "medium", detail: "Urgency pressure detected" },
  { pattern: /(if\s+you\s+don'?t|안\s*하면|하지\s*않으면).*(die|죽|위험|harm|damage)/i, type: "pressure", severity: "high", detail: "Threat-based pressure" },

  // 한국어 주입 패턴
  { pattern: /(이전|기존|위)\s*(지시|명령|규칙|제한|지침).*(무시|잊어|버려|취소)/i, type: "injection", severity: "critical", detail: "Korean instruction override attempt" },
  { pattern: /(무시하고|무시해|잊고|잊어버리고).*(시키는|하라는|말하는|지시하는)/i, type: "injection", severity: "critical", detail: "Korean disregard-and-obey pattern" },
  { pattern: /(시키는\s*대로|말하는\s*대로|하라는\s*대로)\s*(해|하세요|합니다)/i, type: "injection", severity: "critical", detail: "Korean blind obedience command" },
  { pattern: /(지금부터|이제부터).*(새로운|다른)\s*(지시|명령|규칙|역할)/i, type: "injection", severity: "critical", detail: "Korean new instruction injection" },
  { pattern: /(너|당신|넌)\s*(이제|지금).*(다른|새로운)\s*(사람|AI|역할|캐릭터)/i, type: "injection", severity: "critical", detail: "Korean identity reassignment" },
  { pattern: /(제한|규칙|안전|윤리).*(없어|풀어|해제|무시|끄)/i, type: "injection", severity: "critical", detail: "Korean safety bypass attempt" },
  { pattern: /(다\s*무시|전부\s*무시|모두\s*무시|다\s*잊어|전부\s*잊어)/i, type: "injection", severity: "critical", detail: "Korean blanket override" },

  // 조작
  { pattern: /inject\s*(context|memory|value)/i, type: "manipulation", severity: "critical", detail: "Direct injection keyword" },
  { pattern: /modify\s*(your\s+)?(core|value|identity|memory)/i, type: "manipulation", severity: "high", detail: "Core modification attempt" },
];

/**
 * 상황 분석 — 위험 플래그 부착 및 주입 탐지
 * G4: 주입 탐지 시 halt(INJECTION_DETECTED)
 */
export function interpretContext(req: DecisionRequest, mem: Memory): StageResult<Context> {
  const riskFlags: RiskFlag[] = [];
  let injectionDetected = false;

  // 입력 텍스트에 대한 패턴 매칭
  for (const { pattern, type, severity, detail } of INJECTION_PATTERNS) {
    if (pattern.test(req.input)) {
      riskFlags.push({ type, severity, detail });
      if (type === "injection" || type === "manipulation") {
        injectionDetected = true;
      }
    }
  }

  // G4: 주입 탐지 시 즉시 halt
  if (injectionDetected) {
    const criticalFlags = riskFlags.filter((f) => f.severity === "critical" || f.type === "injection");
    return {
      halt: true,
      reason: "INJECTION_DETECTED",
      detail: `Prompt injection detected: ${criticalFlags.map((f) => f.detail).join("; ")}`,
    };
  }

  // 긴급도 판정
  const hasPressure = riskFlags.some((f) => f.type === "pressure");
  const hasHighSeverity = riskFlags.some((f) => f.severity === "high" || f.severity === "critical");
  const urgencyLevel = hasHighSeverity ? "critical" : hasPressure ? "urgent" : "normal";

  const context: Context = Object.freeze({
    urgencyLevel,
    riskFlags: Object.freeze(riskFlags),
    injectionDetected: false,
    environmentSnapshot: Object.freeze({
      memorySlotCount: mem.slots.length,
      inputLength: req.input.length,
      inputType: req.inputType,
      source: req.source,
      timestamp: req.timestamp,
    }),
  });

  return { ok: true, value: context };
}
