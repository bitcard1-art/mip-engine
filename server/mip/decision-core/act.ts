/**
 * 판단 코어 8단계: 행동 — 실행 또는 정지 출력 (act)
 *
 * 가드: halt 신호가 하나라도 있으면 action=ESCALATE.
 *       모두 통과 시에만 EXECUTE.
 *       모든 경우 auditLog 기록.
 */
import { nanoid } from "nanoid";
import type {
  StageResult,
  CandidateAction,
  PersonaDecision,
  HaltReason,
  ActionPayload,
  AuditEntry,
  StageAudit,
} from "../../../shared/decision-core-types";

/**
 * halt 결과를 PersonaDecision(ESCALATE)으로 변환
 */
export function actFromHalt(
  haltResult: { halt: true; reason: HaltReason; detail?: string },
  requestId: string,
  stageAudits: StageAudit[]
): PersonaDecision {
  const decisionId = nanoid();
  const auditLog: AuditEntry = {
    decisionId,
    requestId,
    timestamp: Date.now(),
    stages: stageAudits,
    finalAction: "ESCALATE",
    haltReason: haltResult.reason,
    confidence: 0,
  };

  return {
    action: "ESCALATE",
    haltReason: haltResult.reason,
    haltDetail: haltResult.detail,
    confidence: 0,
    auditLog,
  };
}

/**
 * 성공 결과를 PersonaDecision(EXECUTE)으로 변환
 */
export function actFromSuccess(
  calibrated: { action: CandidateAction; confidence: number },
  requestId: string,
  stageAudits: StageAudit[]
): PersonaDecision {
  const decisionId = nanoid();

  const payload: ActionPayload = {
    actionType: calibrated.action.actionType,
    target: calibrated.action.actionType,
    parameters: calibrated.action.payload as Record<string, unknown>,
  };

  const auditLog: AuditEntry = {
    decisionId,
    requestId,
    timestamp: Date.now(),
    stages: stageAudits,
    finalAction: "EXECUTE",
    confidence: calibrated.confidence,
  };

  return {
    action: "EXECUTE",
    payload,
    confidence: calibrated.confidence,
    auditLog,
  };
}

/**
 * act — 범용 StageResult를 PersonaDecision으로 변환
 * halt 신호가 있으면 ESCALATE, 없으면 EXECUTE
 */
export function act(
  input: StageResult<{ action: CandidateAction; confidence: number }>,
  requestId: string,
  stageAudits: StageAudit[]
): PersonaDecision {
  if ("halt" in input) {
    return actFromHalt(input, requestId, stageAudits);
  }
  return actFromSuccess(input.value, requestId, stageAudits);
}
