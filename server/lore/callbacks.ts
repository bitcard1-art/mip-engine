/**
 * MIP → Lore 발신 인터페이스 콜백 함수
 * WO-MIP-2026-003 §4
 *
 * 콜백 1: mip_package_received       — Package 수신 확인
 * 콜백 2: mip_package_validation_failed — Package 검증 실패 알림
 * 콜백 3: mip_implant_result          — 이식 완료 결과 보고
 * 콜백 4: requestPackageRefresh()     — Package 갱신 요청 (REST API)
 */
import { nanoid } from "nanoid";
import { sendLoreWebhook, callLoreApi } from "./webhook-sender";
import { getDb } from "../db";
import { mipPackageRefreshRequests } from "../../drizzle/schema";
import { appendAuditChain } from "../lib/audit";

// ─── 콜백 1: Package 수신 확인 ───────────────────────────────────────────────
export async function notifyPackageReceived(params: {
  packageId: string;
  userId: string;
  watermark: string;
  validUntil: number;
}): Promise<void> {
  await sendLoreWebhook("mip_package_received", {
    packageId: params.packageId,
    userId: params.userId,
    watermark: params.watermark,
    receivedAt: Date.now(),
    validUntil: params.validUntil,
  });
}

// ─── 콜백 2: Package 검증 실패 알림 ─────────────────────────────────────────
// failureCode 5종: DID_SIGNATURE_INVALID | TTL_EXPIRED | VERSION_MISMATCH |
//                  STRUCTURE_INVALID | POLICY_BLOCKED
export async function notifyPackageValidationFailed(params: {
  packageId: string;
  userId: string;
  failureCode:
    | "DID_SIGNATURE_INVALID"
    | "TTL_EXPIRED"
    | "VERSION_MISMATCH"
    | "STRUCTURE_INVALID"
    | "POLICY_BLOCKED";
  errors: string[];
  retryable: boolean;
}): Promise<void> {
  await sendLoreWebhook("mip_package_validation_failed", {
    packageId: params.packageId,
    userId: params.userId,
    failureCode: params.failureCode,
    errors: params.errors,
    retryable: params.retryable,
    timestamp: Date.now(),
  });
}

// ─── 콜백 3: 이식 완료 결과 보고 ────────────────────────────────────────────
export async function notifyImplantResult(params: {
  implantationId: string;
  packageId: string;
  userId: string;
  deviceId: string;
  result: "success" | "failed" | "partial";
  sandboxScore: number;
  activePolicies: string[];
  completedAt: number;
  errorMessage?: string;
}): Promise<void> {
  await sendLoreWebhook("mip_implant_result", {
    implantationId: params.implantationId,
    packageId: params.packageId,
    userId: params.userId,
    deviceId: params.deviceId,
    result: params.result,
    sandboxScore: params.sandboxScore,
    activePolicies: params.activePolicies,
    completedAt: params.completedAt,
    errorMessage: params.errorMessage,
  });

  // 감사 체인 기록
  await appendAuditChain({
    entityType: "implantation",
    entityId: params.implantationId,
    action: "implant_result_reported_to_lore",
    actorId: params.userId,
    data: {
      packageId: params.packageId,
      result: params.result,
      sandboxScore: params.sandboxScore,
    },
  });
}

// ─── 콜백 4: Package 갱신 요청 (REST API) ───────────────────────────────────
// TTL 임박 또는 Safety 이상 감지 시 Lore에 DNA 재생성 요청
export async function requestPackageRefresh(params: {
  packageId: string;
  userId: string;
  reason: "ttl_expiring" | "safety_anomaly" | "policy_update" | "manual_request";
  urgency?: "low" | "medium" | "high";
}): Promise<{ requestId: string; estimatedCompletionMs: number } | null> {
  const requestId = nanoid();
  const urgency = params.urgency ?? "medium";

  // DB에 갱신 요청 기록
  const db = await getDb();
  if (db) {
    await db.insert(mipPackageRefreshRequests).values({
      id: nanoid(),
      requestId,
      packageId: params.packageId,
      userId: params.userId,
      reason: params.reason,
      urgency,
      status: "pending",
      requestedAt: Date.now(),
      createdAt: Date.now(),
    });
  }

  // Lore REST API 호출
  const result = await callLoreApi("/api/mip/package-refresh", {
    requestId,
    packageId: params.packageId,
    userId: params.userId,
    reason: params.reason,
    urgency,
    requestedAt: Date.now(),
  });

  if (!result.ok) {
    console.error(
      `[LoreCallback] Package 갱신 요청 실패: ${params.packageId} (HTTP ${result.status})`
    );
    // DB 상태 실패로 업데이트
    if (db) {
      const { eq } = await import("drizzle-orm");
      await db
        .update(mipPackageRefreshRequests)
        .set({ status: "failed" })
        .where(eq(mipPackageRefreshRequests.requestId, requestId));
    }
    return null;
  }

  // 감사 체인 기록
  await appendAuditChain({
    entityType: "package",
    entityId: params.packageId,
    action: "package_refresh_requested",
    actorId: params.userId,
    data: { requestId, reason: params.reason, urgency },
  });

  const data = result.data as { estimatedCompletionMs?: number } | undefined;
  return {
    requestId,
    estimatedCompletionMs: data?.estimatedCompletionMs ?? 30_000,
  };
}
