import { nanoid } from "nanoid";
import { verifyDIDSignatureFull } from "../lib/did";
import { generatePackageWatermark, sha256Hash } from "../lib/hmac";
import { selectiveDisclose } from "../lib/zkp";
import { appendAuditChain } from "../lib/audit";
import { getDb } from "../db";
import { mipPackages } from "../../drizzle/schema";
import type { MIOPackage, PackageValidationResult } from "../../shared/mip-types";

const DEFAULT_TTL_SECONDS = 86400; // 24시간
const MAX_TTL_SECONDS = 604800; // 7일

/**
 * 서브시스템 1: MIO Package Receiver
 * PSDI §9 기반 MIO Package 수신 및 유효성 검증
 */

/**
 * TTL 유효기간 검증 (MPR-04)
 */
export function validateTTL(ttl: number): { valid: boolean; reason?: string; normalizedTtl?: number } {
  // LORE가 밀리초 단위로 보내는 경우 자동 변환
  const ttlSec = ttl > 1e12 ? Math.floor(ttl / 1000) : ttl;
  const now = Math.floor(Date.now() / 1000);
  if (ttlSec <= now) {
    return { valid: false, reason: `Package expired at ${new Date(ttlSec * 1000).toISOString()}` };
  }
  const remainingSeconds = ttlSec - now;
  if (remainingSeconds > MAX_TTL_SECONDS) {
    // 경고만 로깅하고 허용 (LORE 호환)
    console.warn(`[Package TTL] TTL exceeds ${MAX_TTL_SECONDS}s (${remainingSeconds}s remaining), allowing anyway`);
  }
  return { valid: true, normalizedTtl: ttlSec };
}

/**
 * MIO Package 버전 검증
 */
export function validateVersion(version: string | number): boolean {
  const v = String(version);
  // 허용 버전: 2.0, 5 (LORE 호환)
  return v === "2.0" || v === "5" || v === "5.0";
}

/**
 * MIO Package 구조 검증
 */
export function validatePackageStructure(pkg: Partial<MIOPackage>): string[] {
  const errors: string[] = [];
  if (!pkg.packageId) errors.push("Missing packageId");
  if (!pkg.userId) errors.push("Missing userId");
  if (!pkg.dna) errors.push("Missing DNA data");
  if (!pkg.pattern) errors.push("Missing pattern data");
  if (!pkg.context) errors.push("Missing runtime context");
  if (!pkg.signature) errors.push("Missing DID signature");
  if (!pkg.ttl) errors.push("Missing TTL");
  if (!pkg.version) errors.push("Missing version");
  return errors;
}

/**
 * MIO Package 전체 검증 및 수신 처리 (MPR-01 ~ MPR-06)
 */
export async function receiveAndValidatePackage(
  rawPackage: Partial<MIOPackage>
): Promise<PackageValidationResult> {
  const errors: string[] = [];

  // 1. 구조 검증
  const structureErrors = validatePackageStructure(rawPackage);
  errors.push(...structureErrors);

  if (errors.length > 0) {
    return { valid: false, packageId: rawPackage.packageId || "", errors, watermark: "" };
  }

  const pkg = rawPackage as MIOPackage;

  // 2. 버전 검증
  if (!validateVersion(pkg.version)) {
    errors.push(`Unsupported package version: ${pkg.version}. Expected 2.0`);
  }

  // 3. TTL 유효기간 검증 (MPR-04)
  const ttlResult = validateTTL(pkg.ttl);
  if (!ttlResult.valid) {
    errors.push(ttlResult.reason!);
  }

  // 4. DID 서명 기반 무결성 검증 (MPR-02, PSDI §9 수식 16)
  const payloadForVerification = {
    packageId: pkg.packageId,
    userId: pkg.userId,
    dnaHash: sha256Hash(JSON.stringify(pkg.dna)),
    patternHash: sha256Hash(JSON.stringify(pkg.pattern)),
    ttl: pkg.ttl,
    version: pkg.version,
  };
  const didResult = verifyDIDSignatureFull(payloadForVerification, pkg.signature);
  if (!didResult.valid) {
    errors.push(`DID signature verification failed: ${didResult.reason}`);
  }

  // 5. HMAC 워터마크 생성 (MPR-03, PSDI §9 수식 20)
  const watermark = generatePackageWatermark(pkg.packageId, pkg.userId, pkg.ttl);

  // 6. ZKP 선택적 공개 처리 (MPR-06, PSDI §9 수식 18)
  const requiredDNAFields = ["core_identity", "behavioral_baseline", "emotional_range"];
  const _zkpResult = selectiveDisclose(
    pkg.dna.indicators as Record<string, unknown>,
    requiredDNAFields
  );

  const isValid = errors.length === 0;

  // 7. DB 저장
  const db = await getDb();
  if (db) {
    try {
      await db.insert(mipPackages).values({
        id: pkg.packageId,
        userId: pkg.userId,
        packageVersion: String(pkg.version),
        didSignature: JSON.stringify(pkg.signature),
        hmacWatermark: watermark,
        ttl: pkg.ttl,
        status: isValid ? "validated" : "invalid",
        validationErrors: errors.length > 0 ? JSON.stringify(errors) : undefined,
        dnaHash: sha256Hash(JSON.stringify(pkg.dna)),
        patternHash: sha256Hash(JSON.stringify(pkg.pattern)),
        contextJson: JSON.stringify(pkg.context),
        sourceSystem: "lore",
        receivedAt: Date.now(),
        validatedAt: isValid ? Date.now() : undefined,
      });

      // 감사 체인 기록
      await appendAuditChain({
        entityType: "package",
        entityId: pkg.packageId,
        action: isValid ? "package_validated" : "package_rejected",
        actorId: pkg.userId,
        data: { packageId: pkg.packageId, valid: isValid, watermark },
      });
    } catch (err) {
      console.error("[PackageReceiver] DB insert failed:", err);
    }
  }

  return {
    valid: isValid,
    packageId: pkg.packageId,
    errors,
    watermark,
  };
}

/**
 * DLQ (Dead Letter Queue) 저장 - 수신 실패 패키지 (MPR-05)
 * 실제 환경에서는 Redis/RabbitMQ 등 메시지 큐 사용
 */
const deadLetterQueue: Array<{ pkg: Partial<MIOPackage>; reason: string; timestamp: number }> = [];

export function addToDLQ(pkg: Partial<MIOPackage>, reason: string): void {
  deadLetterQueue.push({ pkg, reason, timestamp: Date.now() });
  console.warn(`[PackageReceiver] Added to DLQ: ${pkg.packageId} - ${reason}`);
}

export function getDLQItems() {
  return [...deadLetterQueue];
}

export function clearDLQ(): void {
  deadLetterQueue.length = 0;
}
