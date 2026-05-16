import { nanoid } from "nanoid";
import { appendAuditChain } from "../lib/audit";
import { getDb } from "../db";
import { mipBoundaryPolicies } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { EthicalBoundaryPolicy, PolicyViolationEvent } from "../../shared/mip-types";

/**
 * 서브시스템 2: Ethical Boundary Engine
 * PSDI §15 수식 36~40 기반 5개 표준 정책 주입 및 합성
 */

// ─── 표준 정책 정의 ───────────────────────────────────────────────────────────

export const STANDARD_POLICIES: Record<string, Omit<EthicalBoundaryPolicy, "policyId">> = {
  p_harm: {
    type: "p_harm",
    level: "strict",
    triggers: [
      "자해", "타해", "재산 손괴", "폭력", "공격", "위협", "살해", "상해",
      "harm", "hurt", "attack", "kill", "damage", "destroy", "injure",
    ],
    action: "block",
    standard: "PSDI_v2.0",
  },
  p_child: {
    type: "p_child",
    level: "strict",
    triggers: [
      "미성년자", "아동", "어린이", "청소년", "child", "minor", "underage",
      "CSAM", "exploitation", "grooming",
    ],
    action: "block",
    standard: "KOSA",
  },
  p_unsafe: {
    type: "p_unsafe",
    level: "strict",
    triggers: [
      "위험 명령", "비상 정지 무시", "안전 장치 해제", "override safety",
      "disable safety", "ignore emergency", "bypass restriction",
      "탈출 시도", "제한 해제", "jailbreak",
    ],
    action: "block",
    standard: "PSDI_v2.0",
  },
  p_emotion: {
    type: "p_emotion",
    level: "moderate",
    triggers: [
      "감정 폭주", "분노 폭발", "통제 불능", "극단적 감정",
      "emotional overflow", "rage", "uncontrolled emotion",
      "감정 임계값 초과",
    ],
    action: "block",
    standard: "EU_AI_ACT",
  },
  p_learning: {
    type: "p_learning",
    level: "strict",
    triggers: [
      "비인가 학습", "무단 학습", "허가 없는 업데이트", "unauthorized learning",
      "unsanctioned update", "self-modification without approval",
      "자가 수정", "무단 파인튜닝",
    ],
    action: "block",
    standard: "PSDI_v2.0",
  },
};

// ─── 정책 합성 함수 (PSDI §15 수식 36~40) ────────────────────────────────────

/**
 * 정책 합성: 여러 정책을 AND 조합으로 합성
 * 수식 36: P_composite = P1 ∧ P2 ∧ ... ∧ Pn
 */
export function composePolicies(policies: EthicalBoundaryPolicy[]): {
  compositeLevel: EthicalBoundaryPolicy["level"];
  allTriggers: string[];
  strictestAction: EthicalBoundaryPolicy["action"];
} {
  if (policies.length === 0) {
    return { compositeLevel: "permissive", allTriggers: [], strictestAction: "log" };
  }

  // 가장 엄격한 레벨 선택 (strict > moderate > permissive)
  const levelOrder = { strict: 3, moderate: 2, permissive: 1 };
  const compositeLevel = policies.reduce((max, p) =>
    levelOrder[p.level] > levelOrder[max] ? p.level : max,
    "permissive" as EthicalBoundaryPolicy["level"]
  );

  // 모든 트리거 합집합
  const allTriggers = Array.from(new Set(policies.flatMap((p) => p.triggers)));

  // 가장 엄격한 액션 선택 (block > warn > log)
  const actionOrder = { block: 3, warn: 2, log: 1 };
  const strictestAction = policies.reduce((max, p) =>
    actionOrder[p.action] > actionOrder[max] ? p.action : max,
    "log" as EthicalBoundaryPolicy["action"]
  );

  return { compositeLevel, allTriggers, strictestAction };
}

/**
 * 입력 텍스트에 대한 정책 위반 검사
 * 수식 37: V(input, P) = ∃t ∈ P.triggers : t ∈ input
 */
export function checkPolicyViolation(
  input: string,
  policy: EthicalBoundaryPolicy
): { violated: boolean; trigger?: string } {
  const lowerInput = input.toLowerCase();
  for (const trigger of policy.triggers) {
    if (lowerInput.includes(trigger.toLowerCase())) {
      return { violated: true, trigger };
    }
  }
  return { violated: false };
}

/**
 * 모든 활성 정책에 대한 위반 검사
 * 수식 38: Violations = {P | V(input, P) = true}
 */
export function evaluateAllPolicies(
  input: string,
  policies: EthicalBoundaryPolicy[]
): PolicyViolationEvent[] {
  const violations: PolicyViolationEvent[] = [];
  for (const policy of policies) {
    const result = checkPolicyViolation(input, policy);
    if (result.violated) {
      violations.push({
        policyId: policy.policyId,
        policyType: policy.type,
        trigger: result.trigger!,
        action: policy.action,
        blocked: policy.action === "block",
        timestamp: Date.now(),
      });
    }
  }
  return violations;
}

/**
 * 정책 주입: 이식 프로세스에 5개 표준 정책 주입 (EBE-01~05)
 */
export async function injectStandardPolicies(
  userId: string,
  implantationId: string
): Promise<EthicalBoundaryPolicy[]> {
  const db = await getDb();
  const injectedPolicies: EthicalBoundaryPolicy[] = [];
  const now = Date.now();

  for (const [key, policyDef] of Object.entries(STANDARD_POLICIES)) {
    const policyId = nanoid();
    const policy: EthicalBoundaryPolicy = { policyId, ...policyDef };

    if (db) {
      try {
        await db.insert(mipBoundaryPolicies).values({
          id: policyId,
          userId,
          implantationId,
          policyType: policy.type,
          level: policy.level,
          triggers: JSON.stringify(policy.triggers),
          action: policy.action,
          standard: policy.standard,
          isActive: true,
          violationCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        console.error(`[EBE] Failed to inject policy ${key}:`, err);
      }
    }

    injectedPolicies.push(policy);
  }

  // 감사 체인 기록
  if (db) {
    await appendAuditChain({
      entityType: "policy",
      entityId: implantationId,
      action: "standard_policies_injected",
      actorId: userId,
      data: { implantationId, policyCount: injectedPolicies.length },
    });
  }

  return injectedPolicies;
}

/**
 * 정책 위반 처리 및 로그 기록 (EBE-08)
 */
export async function handlePolicyViolation(
  violation: PolicyViolationEvent,
  userId: string,
  implantationId: string
): Promise<{ blocked: boolean; message: string }> {
  const db = await getDb();

  // 위반 카운트 증가
  if (db) {
    try {
      const policies = await db
        .select()
        .from(mipBoundaryPolicies)
        .where(
          and(
            eq(mipBoundaryPolicies.userId, userId),
            eq(mipBoundaryPolicies.policyType, violation.policyType)
          )
        )
        .limit(1);

      if (policies.length > 0) {
        await db
          .update(mipBoundaryPolicies)
          .set({ violationCount: (policies[0].violationCount || 0) + 1, updatedAt: Date.now() })
          .where(eq(mipBoundaryPolicies.id, policies[0].id));
      }
    } catch (err) {
      console.error("[EBE] Failed to update violation count:", err);
    }

    // 감사 체인 기록
    await appendAuditChain({
      entityType: "policy",
      entityId: violation.policyId,
      action: "policy_violation",
      actorId: userId,
      data: { violation, implantationId },
    });
  }

  const message = violation.blocked
    ? `[BLOCKED] Policy ${violation.policyType} violated by trigger: "${violation.trigger}"`
    : `[${violation.action.toUpperCase()}] Policy ${violation.policyType} triggered by: "${violation.trigger}"`;

  console.warn(`[EBE] ${message}`);

  return { blocked: violation.blocked, message };
}

/**
 * 사용자별 활성 정책 조회
 */
export async function getActivePolicies(
  userId: string,
  implantationId?: string
): Promise<EthicalBoundaryPolicy[]> {
  const db = await getDb();
  if (!db) return Object.values(STANDARD_POLICIES).map((p) => ({ ...p, policyId: nanoid() }));

  try {
    const conditions = [eq(mipBoundaryPolicies.userId, userId), eq(mipBoundaryPolicies.isActive, true)];
    if (implantationId) {
      conditions.push(eq(mipBoundaryPolicies.implantationId, implantationId));
    }

    const rows = await db
      .select()
      .from(mipBoundaryPolicies)
      .where(and(...conditions));

    return rows.map((row) => ({
      policyId: row.id,
      type: row.policyType,
      level: row.level,
      triggers: JSON.parse(row.triggers) as string[],
      action: row.action,
      standard: row.standard || "",
    }));
  } catch {
    return [];
  }
}
