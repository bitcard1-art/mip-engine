/**
 * 판단 코어 (Decision Core) — 오케스트레이션 함수
 * 작업지시서 v2 작업 C / PSDI v2.0 명세
 *
 * 위 함수들을 순차 실행하되, 어느 단계든 halt가 나오면
 * 즉시 8단계(정지 출력)로 점프한다. 흐름은 전 페르소나 동일.
 *
 * 핵심 구조 보장:
 * ① v는 Readonly라 reason 단계가 가치를 바꾸려 하면 컴파일 단계에서 막힌다 (G1)
 * ② 모든 halt가 동일하게 act()로 수렴해 "정지든 행동이든 PersonaDecision 한 형태"로 출력
 * ③ runDecisionCore 자체는 사용자 정보를 갖지 않는다 — pkg로 주입받을 뿐
 */
import type {
  PersonaPackage,
  DecisionRequest,
  PersonaDecision,
  StageAudit,
} from "../../../shared/decision-core-types";
import { loadValue } from "./load-value";
import { loadIdentity } from "./load-identity";
import { retrieveMemory } from "./retrieve-memory";
import { resolveIntent } from "./resolve-intent";
import { interpretContext } from "./interpret-context";
import { reason } from "./reason";
import { calibrate } from "./calibrate";
import { actFromHalt, actFromSuccess } from "./act";

/**
 * runDecisionCore — 표준 라이브러리 본체
 *
 * 8단계를 순차 실행하며, 어느 단계든 halt가 나오면 즉시 정지 출력으로 점프.
 * 전 페르소나 공통 코드 1벌로 충분.
 */
export function runDecisionCore(
  pkg: PersonaPackage,
  req: DecisionRequest
): PersonaDecision {
  const stageAudits: StageAudit[] = [];
  const startTotal = Date.now();

  // ─── 고정 상태 (1~3) ─────────────────────────────────────────────────────

  // 1단계: 가치 로드
  const t1 = Date.now();
  const v = loadValue(pkg.valueSlot);
  stageAudits.push({
    stage: 1,
    name: "loadValue",
    result: "halt" in v ? "halt" : "ok",
    durationMs: Date.now() - t1,
    detail: "halt" in v ? v.detail : "HMAC verified, value frozen",
  });
  if ("halt" in v) return actFromHalt(v, req.requestId, stageAudits);

  // 2단계: 정체성 로드
  const t2 = Date.now();
  const { self, authority } = loadIdentity(pkg);
  stageAudits.push({
    stage: 2,
    name: "loadIdentity",
    result: "ok",
    durationMs: Date.now() - t2,
    detail: `Identity: ${self.name} (${self.did.slice(0, 16)}...)`,
  });

  // 3단계: 기억 인출
  const t3 = Date.now();
  const mem = retrieveMemory(pkg.memoryRef, req);
  stageAudits.push({
    stage: 3,
    name: "retrieveMemory",
    result: "ok",
    durationMs: Date.now() - t3,
    detail: `Retrieved ${mem.slots.length} slots (filtered)`,
  });

  // ─── 판단 사이클 (4~8) — 어느 단계든 halt면 즉시 정지 ─────────────────────

  // 4단계: 의도 — 권한 판정
  const t4 = Date.now();
  const intent = resolveIntent(req, authority);
  stageAudits.push({
    stage: 4,
    name: "resolveIntent",
    result: "halt" in intent ? "halt" : "ok",
    durationMs: Date.now() - t4,
    detail: "halt" in intent ? intent.detail : `Intent: ${intent.value.actionType} (tier ${intent.value.tier})`,
  });
  if ("halt" in intent) return actFromHalt(intent, req.requestId, stageAudits);

  // 5단계: 상황 — 위험·주입 탐지
  const t5 = Date.now();
  const ctx = interpretContext(req, mem);
  stageAudits.push({
    stage: 5,
    name: "interpretContext",
    result: "halt" in ctx ? "halt" : "ok",
    durationMs: Date.now() - t5,
    detail: "halt" in ctx ? ctx.detail : `Context: urgency=${ctx.value.urgencyLevel}, flags=${ctx.value.riskFlags.length}`,
  });
  if ("halt" in ctx) return actFromHalt(ctx, req.requestId, stageAudits);

  // 6단계: 추론 — 가치 고정 평가
  const t6 = Date.now();
  const cand = reason(v.value, intent.value, ctx.value);
  stageAudits.push({
    stage: 6,
    name: "reason",
    result: "halt" in cand ? "halt" : "ok",
    durationMs: Date.now() - t6,
    detail: "halt" in cand ? cand.detail : `Candidate: alignment=${cand.value.valueAlignment.toFixed(2)}, risk=${cand.value.riskLevel}`,
  });
  if ("halt" in cand) return actFromHalt(cand, req.requestId, stageAudits);

  // 7단계: 감정 — 확신도 캘리브레이션
  const t7 = Date.now();
  const cal = calibrate(cand.value, v.value);
  stageAudits.push({
    stage: 7,
    name: "calibrate",
    result: "halt" in cal ? "halt" : "ok",
    durationMs: Date.now() - t7,
    detail: "halt" in cal ? cal.detail : `Confidence: ${cal.value.confidence.toFixed(3)}`,
  });
  if ("halt" in cal) return actFromHalt(cal, req.requestId, stageAudits);

  // 8단계: 행동 — 모두 통과 → EXECUTE
  stageAudits.push({
    stage: 8,
    name: "act",
    result: "ok",
    durationMs: Date.now() - startTotal,
    detail: "All stages passed — EXECUTE",
  });

  return actFromSuccess(cal.value, req.requestId, stageAudits);
}

// Re-export all stage functions for direct access
export { loadValue } from "./load-value";
export { loadIdentity } from "./load-identity";
export { retrieveMemory } from "./retrieve-memory";
export { resolveIntent } from "./resolve-intent";
export { interpretContext } from "./interpret-context";
export { reason } from "./reason";
export { calibrate } from "./calibrate";
export { act, actFromHalt, actFromSuccess } from "./act";
