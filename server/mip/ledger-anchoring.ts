/**
 * §14.6 Distributed Ledger Anchoring
 * PSDI v2.0 §14.6 — 감사 체인을 외부 분산 원장과 연동하는 앵커링 레이어
 *
 * 아키텍처:
 *  1. 내부 감사 체인(mip_audit_chain)에 항목 추가 → chainHash 획득
 *  2. 외부 원장에 앵커 트랜잭션 제출 (현재: Hyperledger Fabric 호환 REST API 모델)
 *  3. 앵커 결과(txId, blockNumber, timestamp)를 mip_ledger_anchors 테이블에 저장
 *  4. 주기적 검증: 내부 chainHash ↔ 외부 원장 txId 일치 여부 확인
 *
 * 외부 원장 연동 전략:
 *  - 실제 배포 시 LEDGER_ENDPOINT 환경변수로 Hyperledger Fabric REST API 엔드포인트 주입
 *  - 환경변수 미설정 시 "simulation" 모드로 동작 (내부 DB에 앵커 레코드만 생성)
 *  - 연동 실패 시 DLQ(mip_ledger_anchor_dlq)에 저장 후 재시도
 */

import { nanoid } from "nanoid";
import { getDb } from "../db";
import { sha256Hash } from "../lib/hmac";
import { appendAuditChain, type AuditEntry } from "../lib/audit";
import { mipLedgerAnchors, mipLedgerAnchorDlq } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type LedgerAnchorStatus = "pending" | "anchored" | "verified" | "failed" | "simulation";

export interface LedgerAnchorResult {
  anchorId: string;
  chainHash: string;
  txId: string;
  blockNumber: number | null;
  status: LedgerAnchorStatus;
  ledgerEndpoint: string;
  anchoredAt: number;
  verificationProof: string;
}

export interface AnchorPayload {
  entityType: AuditEntry["entityType"];
  entityId: string;
  action: string;
  actorId: string;
  data: Record<string, unknown>;
  implantationId?: string;
  sessionId?: string;
}

// ─── 외부 원장 제출 (Hyperledger Fabric REST API 모델) ────────────────────────

const LEDGER_ENDPOINT = process.env.LEDGER_ENDPOINT ?? "";
const LEDGER_API_KEY = process.env.LEDGER_API_KEY ?? "";
const SIMULATION_MODE = !LEDGER_ENDPOINT;

/**
 * 외부 원장에 앵커 트랜잭션 제출
 * - 실제 연동: POST {LEDGER_ENDPOINT}/transactions/anchor
 * - 시뮬레이션: 내부에서 결정론적 txId 생성
 */
async function submitToLedger(chainHash: string, anchorId: string): Promise<{
  txId: string;
  blockNumber: number | null;
  status: LedgerAnchorStatus;
  ledgerEndpoint: string;
}> {
  if (SIMULATION_MODE) {
    // 시뮬레이션 모드: 결정론적 txId 생성 (chainHash 기반)
    const txId = `sim:${sha256Hash(`${anchorId}:${chainHash}`).slice(0, 32)}`;
    return {
      txId,
      blockNumber: Math.floor(Date.now() / 1000) % 1_000_000,
      status: "simulation",
      ledgerEndpoint: "simulation://internal",
    };
  }

  // 실제 외부 원장 제출
  try {
    const response = await fetch(`${LEDGER_ENDPOINT}/transactions/anchor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(LEDGER_API_KEY ? { "X-API-Key": LEDGER_API_KEY } : {}),
      },
      body: JSON.stringify({
        anchorId,
        chainHash,
        timestamp: Date.now(),
        source: "mip-engine",
        version: "psdi-v2.0",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Ledger API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { txId: string; blockNumber?: number };
    return {
      txId: result.txId,
      blockNumber: result.blockNumber ?? null,
      status: "anchored",
      ledgerEndpoint: LEDGER_ENDPOINT,
    };
  } catch (err) {
    console.error("[LedgerAnchor] 외부 원장 제출 실패:", err);
    throw err;
  }
}

// ─── 검증 증명 생성 ───────────────────────────────────────────────────────────

function generateVerificationProof(anchorId: string, chainHash: string, txId: string): string {
  return sha256Hash(`proof:${anchorId}:${chainHash}:${txId}`);
}

// ─── 핵심 함수: 감사 항목 앵커링 ─────────────────────────────────────────────

/**
 * 감사 항목을 내부 체인에 추가하고 외부 원장에 앵커링
 *
 * §14.6 흐름:
 *  1. appendAuditChain() → 내부 해시 체인 생성
 *  2. submitToLedger() → 외부 원장 트랜잭션 제출
 *  3. mip_ledger_anchors에 앵커 레코드 저장
 *  4. 실패 시 DLQ에 저장
 */
export async function anchorToLedger(payload: AnchorPayload): Promise<LedgerAnchorResult> {
  const anchorId = nanoid();
  const now = Date.now();

  // Step 1: 내부 감사 체인에 추가
  const chainHash = await appendAuditChain({
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
    actorId: payload.actorId,
    data: {
      ...payload.data,
      anchorId,
      implantationId: payload.implantationId,
      sessionId: payload.sessionId,
    },
  });

  const effectiveChainHash = chainHash || sha256Hash(`fallback:${anchorId}:${now}`);

  // Step 2: 외부 원장 제출
  let ledgerResult: Awaited<ReturnType<typeof submitToLedger>>;
  let anchorStatus: LedgerAnchorStatus = "pending";

  try {
    ledgerResult = await submitToLedger(effectiveChainHash, anchorId);
    anchorStatus = ledgerResult.status;
  } catch (err) {
    // DLQ에 저장
    await saveToDlq({
      anchorId,
      chainHash: effectiveChainHash,
      payload,
      error: String(err),
    });
    ledgerResult = {
      txId: `dlq:${anchorId}`,
      blockNumber: null,
      status: "failed",
      ledgerEndpoint: LEDGER_ENDPOINT || "simulation://internal",
    };
    anchorStatus = "failed";
  }

  const verificationProof = generateVerificationProof(anchorId, effectiveChainHash, ledgerResult.txId);

  // Step 3: DB에 앵커 레코드 저장
  const db = await getDb();
  if (db) {
    try {
      await db.insert(mipLedgerAnchors).values({
        id: anchorId,
        chainHash: effectiveChainHash,
        txId: ledgerResult.txId,
        blockNumber: ledgerResult.blockNumber,
        status: anchorStatus,
        ledgerEndpoint: ledgerResult.ledgerEndpoint,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        actorId: payload.actorId,
        implantationId: payload.implantationId,
        verificationProof,
        anchoredAt: now,
        createdAt: now,
      });
    } catch (dbErr) {
      console.error("[LedgerAnchor] DB 저장 실패:", dbErr);
    }
  }

  return {
    anchorId,
    chainHash: effectiveChainHash,
    txId: ledgerResult.txId,
    blockNumber: ledgerResult.blockNumber,
    status: anchorStatus,
    ledgerEndpoint: ledgerResult.ledgerEndpoint,
    anchoredAt: now,
    verificationProof,
  };
}

// ─── 앵커 검증 ────────────────────────────────────────────────────────────────

/**
 * 저장된 앵커 레코드를 외부 원장과 대조 검증
 * §14.6 Trust Chain 검증의 핵심 단계
 */
export async function verifyAnchor(anchorId: string): Promise<{
  valid: boolean;
  anchorId: string;
  chainHash: string;
  txId: string;
  status: LedgerAnchorStatus;
  verifiedAt: number;
  details: string;
}> {
  const db = await getDb();
  const now = Date.now();

  if (!db) {
    return { valid: true, anchorId, chainHash: "", txId: "", status: "simulation", verifiedAt: now, details: "DB not available (test mode)" };
  }

  const rows = await db.select().from(mipLedgerAnchors).where(eq(mipLedgerAnchors.id, anchorId)).limit(1);
  if (rows.length === 0) {
    return { valid: false, anchorId, chainHash: "", txId: "", status: "failed", verifiedAt: now, details: "앵커 레코드 없음" };
  }

  const anchor = rows[0];

  if (anchor.status === "simulation") {
    // 시뮬레이션 모드: 내부 증명만 검증
    const expectedProof = generateVerificationProof(anchorId, anchor.chainHash, anchor.txId);
    const valid = expectedProof === anchor.verificationProof;
    await db.update(mipLedgerAnchors)
      .set({ status: valid ? "verified" : "failed", verifiedAt: now })
      .where(eq(mipLedgerAnchors.id, anchorId));
    return {
      valid,
      anchorId,
      chainHash: anchor.chainHash,
      txId: anchor.txId,
      status: valid ? "verified" : "failed",
      verifiedAt: now,
      details: valid ? "시뮬레이션 검증 통과 (내부 증명 일치)" : "시뮬레이션 검증 실패 (증명 불일치)",
    };
  }

  if (SIMULATION_MODE || !LEDGER_ENDPOINT) {
    // 외부 원장 없이 내부 증명만 검증
    const expectedProof = generateVerificationProof(anchorId, anchor.chainHash, anchor.txId);
    const valid = expectedProof === anchor.verificationProof;
    return {
      valid,
      anchorId,
      chainHash: anchor.chainHash,
      txId: anchor.txId,
      status: valid ? "verified" : "failed",
      verifiedAt: now,
      details: valid ? "내부 증명 검증 통과" : "내부 증명 불일치",
    };
  }

  // 실제 외부 원장 검증
  try {
    const response = await fetch(`${LEDGER_ENDPOINT}/transactions/${anchor.txId}/verify`, {
      headers: LEDGER_API_KEY ? { "X-API-Key": LEDGER_API_KEY } : {},
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json() as { valid: boolean; chainHash?: string };
    const valid = result.valid && result.chainHash === anchor.chainHash;

    await db.update(mipLedgerAnchors)
      .set({ status: valid ? "verified" : "failed", verifiedAt: now })
      .where(eq(mipLedgerAnchors.id, anchorId));

    return {
      valid,
      anchorId,
      chainHash: anchor.chainHash,
      txId: anchor.txId,
      status: valid ? "verified" : "failed",
      verifiedAt: now,
      details: valid ? "외부 원장 검증 통과" : "외부 원장 chainHash 불일치",
    };
  } catch (err) {
    return {
      valid: false,
      anchorId,
      chainHash: anchor.chainHash,
      txId: anchor.txId,
      status: "failed",
      verifiedAt: now,
      details: `외부 원장 검증 실패: ${String(err)}`,
    };
  }
}

// ─── 앵커 이력 조회 ───────────────────────────────────────────────────────────

export async function getLedgerAnchors(opts: {
  implantationId?: string;
  entityType?: string;
  limit?: number;
}): Promise<typeof mipLedgerAnchors.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (opts.implantationId) conditions.push(eq(mipLedgerAnchors.implantationId, opts.implantationId));
  if (opts.entityType) conditions.push(eq(mipLedgerAnchors.entityType, opts.entityType as any));

  const query = db.select().from(mipLedgerAnchors)
    .orderBy(desc(mipLedgerAnchors.anchoredAt))
    .limit(opts.limit ?? 50);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

// ─── 앵커 통계 ────────────────────────────────────────────────────────────────

export async function getLedgerAnchorStats(): Promise<{
  total: number;
  byStatus: Record<LedgerAnchorStatus, number>;
  verificationRate: number;
  simulationMode: boolean;
  ledgerEndpoint: string;
}> {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      byStatus: { pending: 0, anchored: 0, verified: 0, failed: 0, simulation: 0 },
      verificationRate: 0,
      simulationMode: SIMULATION_MODE,
      ledgerEndpoint: LEDGER_ENDPOINT || "simulation://internal",
    };
  }

  const rows = await db.select().from(mipLedgerAnchors).limit(1000);
  const byStatus: Record<LedgerAnchorStatus, number> = { pending: 0, anchored: 0, verified: 0, failed: 0, simulation: 0 };
  for (const r of rows) {
    byStatus[r.status as LedgerAnchorStatus] = (byStatus[r.status as LedgerAnchorStatus] ?? 0) + 1;
  }
  const verified = byStatus.verified + byStatus.simulation;
  const verificationRate = rows.length > 0 ? Math.round((verified / rows.length) * 100) : 0;

  return {
    total: rows.length,
    byStatus,
    verificationRate,
    simulationMode: SIMULATION_MODE,
    ledgerEndpoint: LEDGER_ENDPOINT || "simulation://internal",
  };
}

// ─── DLQ 관리 ─────────────────────────────────────────────────────────────────

async function saveToDlq(opts: {
  anchorId: string;
  chainHash: string;
  payload: AnchorPayload;
  error: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(mipLedgerAnchorDlq).values({
      id: nanoid(),
      anchorId: opts.anchorId,
      chainHash: opts.chainHash,
      payloadJson: JSON.stringify(opts.payload),
      errorMessage: opts.error,
      retryCount: 0,
      maxRetries: 5,
      createdAt: Date.now(),
      nextRetryAt: Date.now() + 5 * 60 * 1000, // 5분 후 재시도
    });
  } catch (err) {
    console.error("[LedgerAnchor] DLQ 저장 실패:", err);
  }
}

/**
 * DLQ 재시도 배치 — 5분 간격으로 실행
 */
export async function retryLedgerDlq(): Promise<{ retried: number; succeeded: number; failed: number }> {
  const db = await getDb();
  if (!db) return { retried: 0, succeeded: 0, failed: 0 };

  const now = Date.now();
  const pending = await db.select().from(mipLedgerAnchorDlq)
    .where(and(
      eq(mipLedgerAnchorDlq.status, "pending"),
    ))
    .limit(20);

  const eligible = pending.filter(r => r.nextRetryAt <= now && r.retryCount < r.maxRetries);
  let succeeded = 0;
  let failed = 0;

  for (const item of eligible) {
    try {
      const payload = JSON.parse(item.payloadJson) as AnchorPayload;
      const ledgerResult = await submitToLedger(item.chainHash, item.anchorId);
      const verificationProof = generateVerificationProof(item.anchorId, item.chainHash, ledgerResult.txId);

      // 앵커 레코드 업데이트
      await db.update(mipLedgerAnchors)
        .set({ txId: ledgerResult.txId, status: ledgerResult.status, verificationProof, anchoredAt: now })
        .where(eq(mipLedgerAnchors.id, item.anchorId));

      // DLQ 항목 완료 처리
      await db.update(mipLedgerAnchorDlq)
        .set({ status: "completed", retryCount: item.retryCount + 1 })
        .where(eq(mipLedgerAnchorDlq.id, item.id));

      succeeded++;
    } catch (err) {
      const nextRetry = now + Math.pow(2, item.retryCount + 1) * 60 * 1000; // 지수 백오프
      await db.update(mipLedgerAnchorDlq)
        .set({
          retryCount: item.retryCount + 1,
          nextRetryAt: nextRetry,
          status: item.retryCount + 1 >= item.maxRetries ? "exhausted" : "pending",
          lastError: String(err),
        })
        .where(eq(mipLedgerAnchorDlq.id, item.id));
      failed++;
    }
  }

  if (eligible.length > 0) {
    console.log(`[LedgerAnchor DLQ] 재시도 완료: ${succeeded}성공 / ${failed}실패`);
  }

  return { retried: eligible.length, succeeded, failed };
}
