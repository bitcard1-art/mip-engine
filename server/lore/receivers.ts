/**
 * Lore → MIP 수신 인터페이스 핸들러
 * WO-MIP-2026-003 §3
 *
 * 인터페이스 1: POST /api/lore/packages/submit   — MIO Package 전송 수신
 * 인터페이스 2: POST /api/lore/packages/update   — Package 갱신 알림
 * 인터페이스 3: POST /api/lore/packages/revoke   — Package 철회 요청
 * 인터페이스 4: POST /api/lore/packages/dna-ready — DNA 재생성 완료 알림
 */
import { nanoid } from "nanoid";
import type { Request, Response } from "express";
import { getDb } from "../db";
import {
  lorePackageEvents,
  mipPackages,
  mipImplantations,
  mipRuntimeSessions,
  mipSafetyLogs,
  mipPackageRefreshRequests,
} from "../../drizzle/schema";
import { receiveAndValidatePackage } from "../mip/package-receiver";
import { sendLoreWebhook } from "./webhook-sender";
import { appendAuditChain } from "../lib/audit";
import type { MIOPackage } from "../../shared/mip-types";

// ─── 인터페이스 1: MIO Package 전송 수신 ────────────────────────────────────
export async function handlePackageSubmit(req: Request, res: Response): Promise<void> {
  try {
    const { eventId, packageId, userId, package: pkg, eventType } = req.body as {
      eventId: string;
      packageId: string;
      userId: string;
      package: MIOPackage;
      eventType: string;
      generatedAt: number;
    };

    if (!eventId || !packageId || !userId || !pkg) {
      res.status(400).json({ error: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
      return;
    }

    const db = await getDb();

    // 멱등성 검사
    if (db) {
      const { eq } = await import("drizzle-orm");
      const existing = await db
        .select()
        .from(lorePackageEvents)
        .where(eq(lorePackageEvents.eventId, eventId))
        .limit(1);
      if (existing.length > 0) {
        res.status(200).json({ status: "already_processed", packageId });
        return;
      }
    }

    // MIO Package 전체 검증 (DID 서명, TTL, 구조)
    // LORE는 packageId/userId를 최상위에 보내므로 package 내부에 주입
    const fullPkg = { ...pkg, packageId: pkg.packageId || packageId, userId: pkg.userId || userId };
    const validationResult = await receiveAndValidatePackage(fullPkg);

    // 이벤트 로그 저장
    if (db) {
      await db.insert(lorePackageEvents).values({
        id: nanoid(),
        eventId,
        eventType: eventType || "lore_package_ready",
        packageId,
        userId,
        payload: JSON.stringify(req.body),
        processedAt: Date.now(),
        status: validationResult.valid ? "processed" : "failed",
        createdAt: Date.now(),
      });
    }

    if (!validationResult.valid) {
      // 검증 실패 → Lore에 실패 콜백 전송
      const failureCode = validationResult.errors.some((e) => e.includes("DID"))
        ? "DID_SIGNATURE_INVALID"
        : validationResult.errors.some((e) => e.includes("TTL") || e.includes("expired"))
        ? "TTL_EXPIRED"
        : validationResult.errors.some((e) => e.includes("version"))
        ? "VERSION_MISMATCH"
        : "STRUCTURE_INVALID";

      await sendLoreWebhook("mip_package_validation_failed", {
        packageId,
        userId,
        failureCode,
        errors: validationResult.errors,
        retryable: failureCode !== "TTL_EXPIRED",
        timestamp: Date.now(),
      });

      res.status(400).json({
        status: "rejected",
        code: "VALIDATION_FAILED",
        errors: validationResult.errors,
        message: "MIO Package 검증에 실패했습니다.",
      });
      return;
    }

    // 검증 성공 → Lore에 수신 확인 콜백 전송
    await sendLoreWebhook("mip_package_received", {
      packageId,
      userId,
      watermark: validationResult.watermark,
      receivedAt: Date.now(),
      validUntil: pkg.ttl * 1000,
    });

    res.status(202).json({
      status: "accepted",
      packageId,
      watermark: validationResult.watermark,
      message: "MIO Package가 수신되어 검증을 완료했습니다.",
    });
  } catch (err) {
    console.error("[handlePackageSubmit] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `패키지 처리 중 내부 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

// ─── 인터페이스 2: Package 갱신 알림 ────────────────────────────────────────
export async function handlePackageUpdate(req: Request, res: Response): Promise<void> {
  const { eventId, packageId, userId, updatedPackage, reason, eventType } = req.body as {
    eventId: string;
    packageId: string;
    userId: string;
    previousVersion: string;
    updatedFields: string[];
    updatedPackage: MIOPackage;
    reason: string;
    updatedAt: number;
    eventType: string;
  };

  if (!eventId || !packageId || !userId || !updatedPackage) {
    res.status(400).json({ error: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
    return;
  }

  const db = await getDb();

  // 멱등성 검사
  if (db) {
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(lorePackageEvents)
      .where(eq(lorePackageEvents.eventId, eventId))
      .limit(1);
    if (existing.length > 0) {
      res.status(200).json({ status: "already_processed", packageId });
      return;
    }
  }

  // Live Activation 이후 이식 여부 확인
  if (db) {
    const { eq, and } = await import("drizzle-orm");
    const liveImplants = await db
      .select()
      .from(mipImplantations)
      .where(
        and(
          eq(mipImplantations.packageId, packageId),
          eq(mipImplantations.stage, "live_activation")
        )
      )
      .limit(1);

    if (liveImplants.length > 0 && liveImplants[0].status === "completed") {
      res.status(409).json({
        status: "rejected",
        code: "LIVE_ACTIVATION_LOCKED",
        message: "Live Activation 이후에는 Package를 갱신할 수 없습니다.",
      });
      return;
    }
  }

  // 갱신된 패키지 검증
  const validationResult = await receiveAndValidatePackage(updatedPackage);
  if (!validationResult.valid) {
    res.status(400).json({
      status: "rejected",
      code: "VALIDATION_FAILED",
      errors: validationResult.errors,
    });
    return;
  }

  // mip_packages 업데이트
  if (db) {
    const { eq } = await import("drizzle-orm");
    await db
      .update(mipPackages)
      .set({
        hmacWatermark: validationResult.watermark,
        ttl: updatedPackage.ttl,
        status: "validated",
        validatedAt: Date.now(),
      })
      .where(eq(mipPackages.id, packageId));

    // 이벤트 로그 저장
    await db.insert(lorePackageEvents).values({
      id: nanoid(),
      eventId,
      eventType: eventType || "lore_package_updated",
      packageId,
      userId,
      payload: JSON.stringify(req.body),
      processedAt: Date.now(),
      status: "processed",
      createdAt: Date.now(),
    });
  }

  // 감사 체인 기록
  await appendAuditChain({
    entityType: "package",
    entityId: packageId,
    action: "package_updated",
    actorId: userId,
    data: { packageId, reason, watermark: validationResult.watermark },
  });

  res.status(200).json({
    status: "updated",
    packageId,
    appliedAt: Date.now(),
    message: "Package가 갱신되었습니다.",
  });
}

// ─── 인터페이스 3: Package 철회 요청 ────────────────────────────────────────
export async function handlePackageRevoke(req: Request, res: Response): Promise<void> {
  const { eventId, packageId, userId, reason, immediateEffect, eventType } = req.body as {
    eventId: string;
    packageId: string;
    userId: string;
    reason: string;
    immediateEffect: boolean;
    revokedAt: number;
    eventType: string;
  };

  if (!eventId || !packageId || !userId) {
    res.status(400).json({ error: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
    return;
  }

  const db = await getDb();
  const terminatedSessions: string[] = [];

  // 멱등성 검사
  if (db) {
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(lorePackageEvents)
      .where(eq(lorePackageEvents.eventId, eventId))
      .limit(1);
    if (existing.length > 0) {
      res.status(200).json({ status: "already_processed", packageId });
      return;
    }
  }

  if (db) {
    const { eq, and } = await import("drizzle-orm");

    // 패키지 상태 revoked로 변경
    await db
      .update(mipPackages)
      .set({ status: "invalid" })
      .where(eq(mipPackages.id, packageId));

    // 연관된 활성 Runtime 세션 즉시 종료
    const activeSessions = await db
      .select()
      .from(mipRuntimeSessions)
      .where(
        and(
          eq(mipRuntimeSessions.userId, userId),
          eq(mipRuntimeSessions.status, "active")
        )
      );

    for (const session of activeSessions) {
      await db
        .update(mipRuntimeSessions)
        .set({
          status: "terminated",
          terminationReason: "package_revoked",
          updatedAt: Date.now(),
        })
        .where(eq(mipRuntimeSessions.id, session.id));
      terminatedSessions.push(session.id);
    }

    // 진행 중인 이식 작업 중단
    await db
      .update(mipImplantations)
      .set({
        status: "failed",
        errorMessage: `Package revoked: ${reason}`,
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(mipImplantations.packageId, packageId),
          eq(mipImplantations.status, "in_progress")
        )
      );

    // Safety Log 기록
    await db.insert(mipSafetyLogs).values({
      id: nanoid(),
      sessionId: "system",
      userId,
      safetyLevel: 5,
      eventType: "kill_switch_activated",
      severity: "emergency",
      description: `Package 철회로 인한 강제 종료: ${reason}`,
      detail: JSON.stringify({ packageId, reason, terminatedSessions }),
      autoAction: "모든 연관 세션 즉시 종료",
      requiresUserAction: false,
      resolved: true,
      autoResolved: true,
      somaNotified: false,
      createdAt: Date.now(),
      timestamp: Date.now(),
    });

    // 이벤트 로그 저장
    await db.insert(lorePackageEvents).values({
      id: nanoid(),
      eventId,
      eventType: eventType || "lore_package_revoked",
      packageId,
      userId,
      payload: JSON.stringify(req.body),
      processedAt: Date.now(),
      status: "processed",
      createdAt: Date.now(),
    });
  }

  // 감사 체인 기록
  await appendAuditChain({
    entityType: "package",
    entityId: packageId,
    action: "package_revoked",
    actorId: userId,
    data: { packageId, reason, terminatedSessions },
  });

  // Soma에 세션 종료 콜백 전송
  const { sendSomaWebhook } = await import("../soma/webhook-sender");
  for (const sessionId of terminatedSessions) {
    await sendSomaWebhook("mip_session_terminated", {
      sessionId,
      userId,
      deviceId: "unknown",
      terminationReason: "package_revoked",
      sessionDurationMs: 0,
      terminatedAt: Date.now(),
      safetyIncidentCount: 0,
    });
  }

  // Lore에 철회 완료 콜백 전송
  await sendLoreWebhook("mip_package_revoked_confirmed", {
    packageId,
    userId,
    terminatedSessions,
    revokedAt: Date.now(),
  });

  res.status(200).json({
    status: "revoked",
    packageId,
    terminatedSessions,
    revokedAt: Date.now(),
    message: "Package가 철회되었습니다. 연관된 모든 세션이 종료되었습니다.",
  });
}

// ─── 인터페이스 4: DNA 재생성 완료 알림 ─────────────────────────────────────
export async function handleDNAReady(req: Request, res: Response): Promise<void> {
  const { eventId, requestId, packageId, userId, updatedDNA, eventType } = req.body as {
    eventId: string;
    requestId: string;
    packageId: string;
    userId: string;
    updatedDNA: {
      indicators: Record<string, number>;
      version: string;
      generatedAt: number;
    };
    regenerationReason: string;
    completedAt: number;
    eventType: string;
  };

  if (!eventId || !requestId || !packageId || !userId || !updatedDNA) {
    res.status(400).json({ error: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
    return;
  }

  const db = await getDb();

  // 멱등성 검사
  if (db) {
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(lorePackageEvents)
      .where(eq(lorePackageEvents.eventId, eventId))
      .limit(1);
    if (existing.length > 0) {
      res.status(200).json({ status: "already_processed", requestId });
      return;
    }
  }

  if (db) {
    const { eq } = await import("drizzle-orm");

    // requestId로 대기 중인 갱신 요청 조회 및 완료 처리
    const refreshReq = await db
      .select()
      .from(mipPackageRefreshRequests)
      .where(eq(mipPackageRefreshRequests.requestId, requestId))
      .limit(1);

    if (refreshReq.length > 0) {
      await db
        .update(mipPackageRefreshRequests)
        .set({ status: "completed", completedAt: Date.now() })
        .where(eq(mipPackageRefreshRequests.requestId, requestId));
    }

    // DNA 해시 업데이트
    const crypto = await import("crypto");
    const dnaHash = crypto.createHash("sha256").update(JSON.stringify(updatedDNA)).digest("hex");
    await db
      .update(mipPackages)
      .set({ dnaHash, validatedAt: Date.now() })
      .where(eq(mipPackages.id, packageId));

    // 이벤트 로그 저장
    await db.insert(lorePackageEvents).values({
      id: nanoid(),
      eventId,
      eventType: eventType || "lore_dna_regenerated",
      packageId,
      userId,
      payload: JSON.stringify(req.body),
      processedAt: Date.now(),
      status: "processed",
      createdAt: Date.now(),
    });
  }

  // 감사 체인 기록
  await appendAuditChain({
    entityType: "package",
    entityId: packageId,
    action: "dna_regenerated",
    actorId: userId,
    data: { packageId, requestId, dnaVersion: updatedDNA.version },
  });

  res.status(202).json({
    status: "accepted",
    requestId,
    packageId,
    message: "DNA 갱신이 적용되었습니다. 이식 프로세스를 재개합니다.",
  });
}
