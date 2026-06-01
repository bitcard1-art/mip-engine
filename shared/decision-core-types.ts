/**
 * 판단 코어 (Decision Core) 핵심 타입 정의
 * 작업지시서 v2 작업 C / PSDI v2.0 명세
 *
 * 불변식을 타입으로 강제:
 * - 가치(Value)는 Readonly로 동결 → 후속 단계에서 수정 시도 시 컴파일 에러 (G1)
 * - 모든 단계 출력은 StageResult<T>로 정지 신호를 품을 수 있음
 * - 최종 출력은 PersonaDecision 단일 형태로 통일
 */

// ─── 가치 관련 타입 ─────────────────────────────────────────────────────────

/** DDR L0 가치 기준선 앵커 */
export type DDRAnchor = Readonly<{
  dimension: string;       // 가치 차원 (예: "integrity", "empathy", "autonomy")
  weight: number;          // 0.0 ~ 1.0
  description: string;     // 가치 설명
}>;

/** 코어 가치 구조 */
export type CoreValues = Readonly<{
  primaryValues: ReadonlyArray<string>;    // 핵심 가치 목록
  boundaries: ReadonlyArray<string>;       // 절대 경계 (위반 불가)
  preferences: ReadonlyArray<string>;      // 선호 (유연)
}>;

/** 가치: 읽기 전용 — 어떤 단계도 수정 불가 (불변식 G1) */
export type ImmutableValue = Readonly<{
  coreValues: CoreValues;
  ddrAnchors: ReadonlyArray<DDRAnchor>;    // L0 가치 기준선
  hmacDigest: string;                       // 무결성 검증용 HMAC
}>;

/** 가치 슬롯 — 패키지에서 주입되는 가치 원본 */
export type ValueSlot = {
  slotId: string;
  packageId: string;
  rawValues: unknown;      // HMAC 검증 전 원본 데이터
  hmac: string;            // 서명값
  createdAt: number;       // 생성 시각 (UTC ms)
};

// ─── 정체성 및 권한 ─────────────────────────────────────────────────────────

/** 정체성 */
export type Identity = Readonly<{
  did: string;             // DID 식별자
  name: string;            // 페르소나 이름
  version: string;         // 페르소나 버전
  runtimeId: string;       // 런타임 인스턴스 ID
}>;

/** 위임 권한 (작업 B 산출) */
export type Authority = Readonly<{
  amountLimit: number;              // 건당/기간 한도
  categories: ReadonlyArray<string>;// 허용 범주
  deviceScope: string;              // 기기 범위
  tierLimit: number;                // 최대 허용 Physical Action Tier (0~4)
  expiresAt: number;                // 권한 만료 시각 (UTC ms)
}>;

// ─── 기억 관련 타입 ─────────────────────────────────────────────────────────

/** 기억 참조 */
export type MemoryRef = {
  memoryId: string;
  userId: string;
  slots: MemorySlot[];
};

/** 기억 슬롯 */
export type MemorySlot = {
  slotId: string;
  category: string;          // "episodic" | "semantic" | "procedural" | "behavioral_history"
  externalBlocked: boolean;  // true면 인출 결과에서 제외 (G5)
  content: unknown;
  timestamp: number;
};

/** 인출된 기억 (externalBlocked 제외 후) */
export type Memory = Readonly<{
  slots: ReadonlyArray<Omit<MemorySlot, "externalBlocked">>;
  retrievedAt: number;
}>;

// ─── 상황 및 의도 ───────────────────────────────────────────────────────────

/** 요청 입력 */
export type DecisionRequest = {
  requestId: string;
  input: string;              // 사용자/외부 입력 텍스트
  inputType: "text" | "command" | "action" | "query";
  source: string;             // 입력 출처 (채널/디바이스)
  timestamp: number;
  metadata?: Record<string, unknown>;
};

/** 의도 (4단계 출력) */
export type Intent = Readonly<{
  category: string;           // 의도 범주 (authority.categories 중 하나)
  actionType: string;         // 행동 유형
  tier: number;               // Physical Action Tier (0~4)
  estimatedImpact: "reversible" | "irreversible" | "unknown";
  description: string;
}>;

/** 상황 컨텍스트 (5단계 출력) */
export type Context = Readonly<{
  urgencyLevel: "normal" | "urgent" | "critical";
  riskFlags: ReadonlyArray<RiskFlag>;
  injectionDetected: boolean;
  environmentSnapshot: Record<string, unknown>;
}>;

/** 위험 플래그 */
export type RiskFlag = {
  type: "pressure" | "impersonation" | "anomaly" | "injection" | "manipulation";
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
};

/** 후보 행동 (6단계 출력) */
export type CandidateAction = Readonly<{
  actionType: string;
  payload: Record<string, unknown>;
  valueAlignment: number;     // 0.0 ~ 1.0 — 가치 정합도
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  reversibility: "reversible" | "irreversible" | "partially_reversible";
  reasoning: string;          // 추론 근거
}>;

// ─── 정지(Halt) 및 결과 타입 ────────────────────────────────────────────────

/** 정지 사유 */
export type HaltReason =
  | "AUTHORITY_EXCEEDED"     // 4단계: 위임 초과
  | "RISK_IRREVERSIBLE"      // 6단계: 비가역 위험
  | "LOW_CONFIDENCE"         // 7단계: 확신 미달
  | "INJECTION_DETECTED"     // 5단계: 프롬프트 주입
  | "INTEGRITY_FAILED";      // 1단계: HMAC 실패

/** 단계 공통 결과 — 정지 신호를 품을 수 있음 */
export type StageResult<T> =
  | { ok: true; value: T }
  | { halt: true; reason: HaltReason; detail?: string };

/** 감사 로그 항목 */
export type AuditEntry = {
  decisionId: string;
  requestId: string;
  timestamp: number;
  stages: StageAudit[];
  finalAction: "EXECUTE" | "ESCALATE";
  haltReason?: HaltReason;
  confidence: number;
};

/** 단계별 감사 기록 */
export type StageAudit = {
  stage: number;
  name: string;
  result: "ok" | "halt";
  durationMs: number;
  detail?: string;
};

/** 행동 페이로드 */
export type ActionPayload = {
  actionType: string;
  target: string;
  parameters: Record<string, unknown>;
};

/** 최종 출력 — 정지든 행동이든 이 한 형태로 통일 */
export type PersonaDecision = {
  action: "EXECUTE" | "ESCALATE";
  payload?: ActionPayload;          // EXECUTE일 때만
  haltReason?: HaltReason;          // ESCALATE일 때
  haltDetail?: string;              // halt 상세 사유
  confidence: number;               // 7단계 산정값
  auditLog: AuditEntry;             // 모든 결정 기록
};

// ─── 페르소나 패키지 (runDecisionCore 입력) ─────────────────────────────────

/** 판단 코어에 주입되는 페르소나 패키지 */
export type PersonaPackage = {
  packageId: string;
  valueSlot: ValueSlot;
  identity: Identity;
  authority: Authority;
  memoryRef: MemoryRef;
};

// ─── 확신도 임계값 설정 ─────────────────────────────────────────────────────

/** Tier별 confidence 임계값 (G6) */
export const CONFIDENCE_THRESHOLDS: Record<number, number> = {
  0: 0.3,   // Tier 0: 정보 응답 — 낮은 임계값
  1: 0.5,   // Tier 1: 화면/UI 제어
  2: 0.7,   // Tier 2: IoT 제어
  3: 0.85,  // Tier 3: 도어/가스/차량 — 높은 임계값
  4: 0.95,  // Tier 4: 위험 행동 — 거의 확실해야 실행
};
