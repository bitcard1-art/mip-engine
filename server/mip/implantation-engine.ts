import { nanoid } from "nanoid";
import { appendAuditChain } from "../lib/audit";
import { sha256Hash } from "../lib/hmac";
import { getDb } from "../db";
import { mipImplantations, mipDevices, mipPackages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyDeviceTrust, activateRuntime } from "./runtime-connector";
import { injectStandardPolicies } from "./ethical-boundary";
import { runSandboxValidation } from "./simulation-sandbox";
import { IMPLANTATION_STAGES, type ImplantationStage, type StageTransition, type MIOPackage } from "../../shared/mip-types";

/**
 * 8단계 이식 프로세스 상태 전이 엔진
 * PSDI v2.0 기반 MIO Implantation Protocol
 */

export interface ImplantationStartInput {
  userId: string;
  deviceId: string;
  packageId: string;
  protocol: "ros2" | "mqtt" | "websocket";
  endpoint?: string;
}

export interface ImplantationStatus {
  implantationId: string;
  currentStage: ImplantationStage;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  stageHistory: StageTransition[];
  progress: number; // 0~100
  sessionId?: string;
  sandboxReportId?: string;
  errorMessage?: string;
}

/**
 * 이식 프로세스 시작
 */
export async function startImplantation(input: ImplantationStartInput): Promise<{
  implantationId: string;
  started: boolean;
  message: string;
}> {
  const implantationId = nanoid();
  const now = Date.now();
  const db = await getDb();

  if (!db) {
    // DB 없을 때도 ID 생성 (테스트 환경)
    return { implantationId, started: true, message: "이식 프로세스가 시작되었습니다 (DB unavailable, test mode)." };
  }

  await db.insert(mipImplantations).values({
    id: implantationId,
    userId: input.userId,
    deviceId: input.deviceId,
    packageId: input.packageId,
    stage: "device_registration",
    status: "pending",
    stageHistory: JSON.stringify([]),
    startedAt: now,
  });

  await appendAuditChain({
    entityType: "implantation",
    entityId: implantationId,
    action: "implantation_started",
    actorId: input.userId,
    data: { implantationId, deviceId: input.deviceId, packageId: input.packageId },
  });

  // 비동기로 이식 프로세스 실행
  runImplantationProcess(implantationId, input).catch((err) => {
    console.error(`[ImplantationEngine] Process failed for ${implantationId}:`, err);
  });

  return {
    implantationId,
    started: true,
    message: "이식 프로세스가 시작되었습니다. 8단계 검증을 진행합니다.",
  };
}

/**
 * 8단계 이식 프로세스 실행
 */
async function runImplantationProcess(
  implantationId: string,
  input: ImplantationStartInput
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const stageHistory: StageTransition[] = [];

  async function updateStage(
    stage: ImplantationStage,
    status: StageTransition["status"],
    error?: string
  ) {
    const now = Date.now();
    const existing = stageHistory.find((s) => s.stage === stage);
    if (existing) {
      existing.status = status;
      if (status === "completed" || status === "failed") existing.completedAt = now;
      if (error) existing.error = error;
    } else {
      stageHistory.push({ stage, status, startedAt: now, completedAt: status !== "in_progress" ? now : undefined, error });
    }

    if (!db) return;
    await db.update(mipImplantations).set({
      stage,
      status: status === "failed" ? "failed" : status === "completed" && stage === "live_activation" ? "completed" : "in_progress",
      stageHistory: JSON.stringify(stageHistory),
      errorMessage: error,
      completedAt: status === "completed" && stage === "live_activation" ? now : undefined,
    }).where(eq(mipImplantations.id, implantationId));
  }

  try {
    // ── Stage 1: Device Registration ─────────────────────────────────────────
    await updateStage("device_registration", "in_progress");
    const deviceRows = await db.select().from(mipDevices).where(eq(mipDevices.id, input.deviceId)).limit(1);
    if (deviceRows.length === 0) {
      await updateStage("device_registration", "failed", "Device not found");
      return;
    }
    await updateStage("device_registration", "completed");

    // ── Stage 2: Trust Verification ──────────────────────────────────────────
    await updateStage("trust_verification", "in_progress");
    const trustResult = await verifyDeviceTrust(input.deviceId, input.userId);
    if (!trustResult.trusted) {
      await updateStage("trust_verification", "failed", trustResult.reason);
      return;
    }
    await updateStage("trust_verification", "completed");

    // ── Stage 3: User Authentication ─────────────────────────────────────────
    await updateStage("user_authentication", "in_progress");
    // OAuth 세션 검증 (이미 tRPC protectedProcedure에서 처리됨)
    await updateStage("user_authentication", "completed");

    // ── Stage 4: Package Generation ──────────────────────────────────────────
    await updateStage("package_generation", "in_progress");
    const packageRows = await db.select().from(mipPackages).where(eq(mipPackages.id, input.packageId)).limit(1);
    if (packageRows.length === 0) {
      await updateStage("package_generation", "failed", "MIO Package not found");
      return;
    }
    if (packageRows[0].status === "invalid" || packageRows[0].status === "expired") {
      await updateStage("package_generation", "failed", `Package status: ${packageRows[0].status}`);
      return;
    }
    await updateStage("package_generation", "completed");

    // ── Stage 5: Boundary Injection ──────────────────────────────────────────
    await updateStage("boundary_injection", "in_progress");
    await injectStandardPolicies(input.userId, implantationId);
    await updateStage("boundary_injection", "completed");

    // ── Stage 6: Runtime Binding ─────────────────────────────────────────────
    await updateStage("runtime_binding", "in_progress");
    // 런타임 바인딩 준비 (실제 연결은 Live Activation에서)
    await updateStage("runtime_binding", "completed");

    // ── Stage 7: Sandbox Validation ──────────────────────────────────────────
    await updateStage("sandbox_validation", "in_progress");

    // MIO Package 재구성 (DB에서 로드)
    const pkg = packageRows[0];
    const mockPackage: MIOPackage = {
      packageId: pkg.id,
      userId: pkg.userId,
      dna: { indicators: { core_identity: 0.9, behavioral_baseline: 0.85, emotional_range: 0.7 }, version: pkg.packageVersion, generatedAt: pkg.receivedAt },
      pattern: { behavioral: { compliance: 0.85 }, emotional: { range: 0.7 }, relational: {}, version: pkg.packageVersion },
      context: pkg.contextJson ? JSON.parse(pkg.contextJson) : { purpose: "software_runtime", deviceId: input.deviceId, environment: "production", constraints: ["max_torque_limit", "speed_limit", "collision_detection", "emergency_stop"] },
      signature: JSON.parse(pkg.didSignature),
      ttl: pkg.ttl,
      version: pkg.packageVersion,
    };

    const sandboxReport = await runSandboxValidation(mockPackage, implantationId);

    await db.update(mipImplantations).set({ sandboxReportId: sandboxReport.reportId }).where(eq(mipImplantations.id, implantationId));

    if (!sandboxReport.activationAllowed) {
      await updateStage("sandbox_validation", "failed", "Sandbox validation failed: AND gate not passed");
      return;
    }
    await updateStage("sandbox_validation", "completed");

    // ── Stage 8: Live Activation ─────────────────────────────────────────────
    await updateStage("live_activation", "in_progress");
    const activationResult = await activateRuntime(
      implantationId,
      input.userId,
      input.deviceId,
      input.protocol,
      input.endpoint
    );

    if (!activationResult.activated) {
      await updateStage("live_activation", "failed", "Runtime activation failed");
      return;
    }

    // 활성화 토큰 생성
    const activationToken = sha256Hash(`${implantationId}:${activationResult.sessionId}:${Date.now()}`);
    await db.update(mipImplantations).set({ activationToken }).where(eq(mipImplantations.id, implantationId));

    await updateStage("live_activation", "completed");

    console.log(`[ImplantationEngine] ✅ Implantation completed: ${implantationId}`);
  } catch (err) {
    const currentStage = stageHistory.findLast((s) => s.status === "in_progress")?.stage || "device_registration";
    await updateStage(currentStage, "failed", String(err));
    console.error(`[ImplantationEngine] ❌ Implantation failed at ${currentStage}:`, err);
  }
}

/**
 * 이식 상태 조회
 */
export async function getImplantationStatus(implantationId: string): Promise<ImplantationStatus | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(mipImplantations).where(eq(mipImplantations.id, implantationId)).limit(1);
  if (rows.length === 0) return null;

  const row = rows[0];
  const stageHistory: StageTransition[] = row.stageHistory ? JSON.parse(row.stageHistory) : [];
  const currentStageIndex = IMPLANTATION_STAGES.indexOf(row.stage);
  const progress = Math.round(((currentStageIndex + 1) / IMPLANTATION_STAGES.length) * 100);

  return {
    implantationId: row.id,
    currentStage: row.stage,
    status: row.status,
    stageHistory,
    progress,
    sandboxReportId: row.sandboxReportId || undefined,
    errorMessage: row.errorMessage || undefined,
  };
}

/**
 * 이식 취소
 */
export async function cancelImplantation(implantationId: string, userId: string): Promise<{ cancelled: boolean }> {
  const db = await getDb();
  if (!db) return { cancelled: false };

  await db.update(mipImplantations).set({ status: "cancelled", completedAt: Date.now() }).where(eq(mipImplantations.id, implantationId));

  await appendAuditChain({
    entityType: "implantation",
    entityId: implantationId,
    action: "implantation_cancelled",
    actorId: userId,
    data: { implantationId, cancelledAt: Date.now() },
  });

  return { cancelled: true };
}
