/**
 * Soma → MIP 수신 인터페이스 핸들러
 * WO-MIP-2026-002 §3
 *
 * 인터페이스 1: POST /api/soma/webhook/implant-approved
 * 인터페이스 2: POST /api/soma/devices/register
 * 인터페이스 3: GET  /api/soma/implant/:id/status
 * 인터페이스 4: POST /api/soma/sessions/:id/kill
 */
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  mipDevices,
  mipImplantations,
  mipRuntimeSessions,
  mipSafetyLogs,
  mipPackages,
  somaWebhookEvents,
} from "../../drizzle/schema";
import { sendSomaWebhook } from "./webhook-sender";

// 이식 단계별 progress 값 (WO-MIP-2026-002 §3.3)
export const STAGE_PROGRESS: Record<string, number> = {
  device_registration: 10,
  trust_verification: 20,
  user_authentication: 30,
  package_generation: 40,
  boundary_injection: 55,
  runtime_binding: 70,
  sandbox_validation: 85,
  live_activation: 100,
};

// ─── 인터페이스 1: 이식 승인 이벤트 수신 ────────────────────────────────────

export interface ImplantApprovedPayload {
  eventType: "mip_implant_approved";
  eventId: string;
  userId: string;
  deviceId: string;
  packageId: string;
  approvedAt: number;
  userConsent: {
    version: string;
    consentedAt: number;
    scope: string[];
  };
}

export async function handleImplantApproved(payload: ImplantApprovedPayload): Promise<{
  status: string;
  implantationId?: string;
  message?: string;
  code?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 없음");

  // 1. 멱등성 검사 — 동일 eventId 중복 처리 방지
  const existing = await db
    .select()
    .from(somaWebhookEvents)
    .where(eq(somaWebhookEvents.eventId, payload.eventId))
    .limit(1);
  if (existing.length > 0) {
    return { status: "already_processed" };
  }

  // 2. Webhook 이벤트 수신 기록
  await db.insert(somaWebhookEvents).values({
    id: nanoid(),
    eventId: payload.eventId,
    eventType: payload.eventType,
    payload: JSON.stringify(payload),
    status: "received",
    createdAt: Date.now(),
  });

  // 3. 디바이스 신뢰 검증
  const device = await db
    .select()
    .from(mipDevices)
    .where(
      and(
        eq(mipDevices.id, payload.deviceId),
        eq(mipDevices.userId, payload.userId)
      )
    )
    .limit(1);
  if (!device.length || device[0].status === "revoked") {
    await markWebhookFailed(db, payload.eventId);
    return { status: "rejected", code: "DEVICE_NOT_VERIFIED", message: "디바이스가 검증되지 않았습니다." };
  }

  // 4. MIO Package 유효성 확인
  const pkg = await db
    .select()
    .from(mipPackages)
    .where(eq(mipPackages.id, payload.packageId))
    .limit(1);
  if (!pkg.length) {
    await markWebhookFailed(db, payload.eventId);
    return { status: "rejected", code: "INVALID_PACKAGE", message: "MIO Package가 유효하지 않습니다." };
  }
  // TTL 검증
  if (pkg[0].ttl && pkg[0].ttl < Date.now()) {
    await markWebhookFailed(db, payload.eventId);
    return { status: "rejected", code: "PACKAGE_EXPIRED", message: "MIO Package가 만료되었습니다." };
  }

  // 5. 이식 작업 생성 (8단계 시작: trust_verification)
  const implantationId = nanoid();
  await db.insert(mipImplantations).values({
    id: implantationId,
    userId: payload.userId,
    deviceId: payload.deviceId,
    packageId: payload.packageId,
    eventId: payload.eventId,
    stage: "trust_verification",
    status: "in_progress",
    progress: STAGE_PROGRESS["trust_verification"],
    startedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 6. Webhook 이벤트 처리 완료 기록
  await db
    .update(somaWebhookEvents)
    .set({ status: "processed", processedAt: Date.now() })
    .where(eq(somaWebhookEvents.eventId, payload.eventId));

  // 7. Soma에 수신 확인 콜백 전송 (비동기, 실패해도 응답 반환)
  sendSomaWebhook("mip_implant_progress", {
    implantationId,
    userId: payload.userId,
    stage: "trust_verification",
    status: "completed",
    progress: STAGE_PROGRESS["trust_verification"],
    detail: "이식 프로세스가 시작되었습니다. 신뢰 검증 단계 진입.",
    timestamp: Date.now(),
  }).catch((err) => console.error("[Soma Callback] 전송 실패:", err));

  return { status: "accepted", implantationId, message: "이식 프로세스가 시작되었습니다." };
}

async function markWebhookFailed(db: Awaited<ReturnType<typeof getDb>>, eventId: string) {
  if (!db) return;
  await db
    .update(somaWebhookEvents)
    .set({ status: "failed", processedAt: Date.now() })
    .where(eq(somaWebhookEvents.eventId, eventId));
}

// ─── 인터페이스 2: 디바이스 등록 요청 수신 ──────────────────────────────────

export interface DeviceRegisterRequest {
  userId: string;
  deviceType: "humanoid" | "iot" | "software";
  deviceName: string;
  did: string;
  didDocument: object;
  registeredAt: number;
}

export async function handleDeviceRegister(req: DeviceRegisterRequest): Promise<{
  status: string;
  deviceId: string;
  trustLevel: number;
  message?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 없음");

  // 1. DID Document 기본 유효성 검증 (W3C DID v1.0 형식 확인)
  if (!req.did || !req.did.startsWith("did:") || !req.didDocument) {
    throw new Error("Invalid DID Document");
  }

  // 2. 디바이스 중복 등록 확인
  const existing = await db
    .select()
    .from(mipDevices)
    .where(
      and(
        eq(mipDevices.userId, req.userId),
        eq(mipDevices.did, req.did)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    return {
      status: "already_registered",
      deviceId: existing[0].id,
      trustLevel: existing[0].trustLevel ?? 0,
      message: "이미 등록된 디바이스입니다.",
    };
  }

  // 3. 디바이스 등록 (초기 trustLevel = 0, status = pending)
  const deviceId = nanoid();
  await db.insert(mipDevices).values({
    id: deviceId,
    userId: req.userId,
    deviceType: req.deviceType,
    deviceName: req.deviceName,
    did: req.did,
    trustLevel: 0,
    status: "pending",
    metadata: JSON.stringify({ didDocument: req.didDocument }),
    createdAt: Date.now(),
  });

  return {
    status: "registered",
    deviceId,
    trustLevel: 0,
    message: "디바이스가 등록되었습니다. 신뢰 검증이 진행 중입니다.",
  };
}

// ─── 인터페이스 3: 이식 상태 조회 ───────────────────────────────────────────

export async function getImplantStatus(implantationId: string, requestUserId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 없음");

  const rows = await db
    .select()
    .from(mipImplantations)
    .where(eq(mipImplantations.id, implantationId))
    .limit(1);

  if (!rows.length) {
    return null;
  }

  const impl = rows[0];

  // 소유자 확인 (requestUserId가 제공된 경우)
  if (requestUserId && impl.userId !== requestUserId) {
    throw new Error("FORBIDDEN");
  }

  const stageDescriptions: Record<string, string> = {
    device_registration: "디바이스 등록 확인 중",
    trust_verification: "디바이스 신뢰 검증 중",
    user_authentication: "사용자 인증 처리 중",
    package_generation: "MIO Package 생성 중",
    boundary_injection: "경계 정책 주입 중",
    runtime_binding: "Runtime 바인딩 중",
    sandbox_validation: "Sandbox 안전성 검증 중",
    live_activation: "Live Activation 완료",
  };

  return {
    implantationId: impl.id,
    userId: impl.userId,
    stage: impl.stage,
    status: impl.status,
    progress: impl.progress ?? STAGE_PROGRESS[impl.stage ?? "device_registration"] ?? 0,
    currentStageDetail: stageDescriptions[impl.stage ?? "device_registration"] ?? "",
    liveActivatedAt: impl.stage === "live_activation" && impl.status === "completed"
      ? impl.updatedAt
      : undefined,
    errorMessage: impl.status === "failed" ? (impl.errorMessage ?? undefined) : undefined,
  };
}

// ─── 인터페이스 4: Kill Switch 요청 수신 ────────────────────────────────────

export interface KillSwitchRequest {
  userId: string;
  reason: "user_request" | "safety_violation" | "emergency";
  requestedAt: number;
}

export async function handleKillSwitch(
  sessionId: string,
  req: KillSwitchRequest
): Promise<{ status: string; sessionId: string; terminatedAt: number; message?: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 없음");

  // 세션 조회
  const sessions = await db
    .select()
    .from(mipRuntimeSessions)
    .where(eq(mipRuntimeSessions.id, sessionId))
    .limit(1);

  if (!sessions.length) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const session = sessions[0];

  // 소유자 확인 — 본인 세션만 종료 가능
  if (session.userId !== req.userId) {
    throw new Error("FORBIDDEN");
  }

  const terminatedAt = Date.now();

  // 세션 종료 기록
  await db
    .update(mipRuntimeSessions)
    .set({
      status: "terminated",
      terminatedAt,
      terminationReason: req.reason,
      updatedAt: terminatedAt,
    })
    .where(eq(mipRuntimeSessions.id, sessionId));

  // Safety Log 기록
  await db.insert(mipSafetyLogs).values({
    id: nanoid(),
    sessionId,
    userId: req.userId,
    deviceId: session.deviceId ?? "",
    eventType: "kill_switch_activated",
    safetyLevel: 4,
    severity: "high",
    detail: `Kill switch activated by ${req.reason}`,
    autoAction: "runtime_disconnected",
    requiresUserAction: false,
    resolved: true,
    createdAt: terminatedAt,
  });

  // Soma에 세션 종료 콜백 전송
  sendSomaWebhook("mip_session_terminated", {
    sessionId,
    userId: req.userId,
    deviceId: session.deviceId,
    terminationReason: req.reason === "user_request" ? "kill_switch" : req.reason,
    sessionDurationMs: session.createdAt ? terminatedAt - session.createdAt : 0,
    terminatedAt,
    safetyIncidentCount: 1,
  }).catch((err) => console.error("[Soma Callback] 세션 종료 콜백 실패:", err));

  return {
    status: "terminated",
    sessionId,
    terminatedAt,
    message: "Runtime 연결이 즉시 해제되었습니다.",
  };
}
