/**
 * DNA Rollback Engine
 * PSDI Runtime Safety Reinforcement Framework v1.0 — Section 4.2
 *
 * MIO Package의 DNA 버전 스냅샷을 관리하고 이전 버전으로 롤백한다.
 * 모든 DNA 주입은 버전 관리, 서명, 변경 로그, Rollback 가능성을 가져야 한다.
 */

import { randomUUID, createHash } from "crypto";
import { getDb } from "../db";
import { mipPackageVersions, mipPackages } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── 버전 스냅샷 생성 ────────────────────────────────────────────────────
export interface DnaSnapshotInput {
  packageId: string;
  userId: string;
  dnaData: Record<string, unknown>;
  patternData?: Record<string, unknown>;
  contextData?: Record<string, unknown>;
  didSignature: string;
  changeReason: string;
  changedBy: string;
  versionTag?: string;
  isRollbackPoint?: boolean;
}

export async function createDnaSnapshot(input: DnaSnapshotInput): Promise<string> {
  const now = Date.now();
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // 현재 최신 버전 번호 조회
  const existing = await db
    .select({ versionNumber: mipPackageVersions.versionNumber })
    .from(mipPackageVersions)
    .where(eq(mipPackageVersions.packageId, input.packageId))
    .orderBy(desc(mipPackageVersions.versionNumber))
    .limit(1);

  const nextVersion = existing.length > 0 ? existing[0].versionNumber + 1 : 1;

  // DNA 해시 계산
  const dnaStr = JSON.stringify(input.dnaData);
  const dnaHash = createHash("sha256").update(dnaStr).digest("hex");
  const patternHash = input.patternData
    ? createHash("sha256").update(JSON.stringify(input.patternData)).digest("hex")
    : null;

  const id = randomUUID();
  await db.insert(mipPackageVersions).values({
    id,
    packageId: input.packageId,
    userId: input.userId,
    versionNumber: nextVersion,
    versionTag: input.versionTag ?? `v${nextVersion}.0`,
    dnaHash,
    patternHash,
    dnaSnapshot: dnaStr,
    patternSnapshot: input.patternData ? JSON.stringify(input.patternData) : null,
    contextJson: input.contextData ? JSON.stringify(input.contextData) : null,
    didSignature: input.didSignature,
    changeReason: input.changeReason,
    changedBy: input.changedBy,
    isRollbackPoint: input.isRollbackPoint ? 1 : 0,
    snapshotAt: now,
    createdAt: now,
  });

  return id;
}

// ─── 버전 목록 조회 ───────────────────────────────────────────────────────
export async function getDnaVersionHistory(packageId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mipPackageVersions)
    .where(eq(mipPackageVersions.packageId, packageId))
    .orderBy(desc(mipPackageVersions.versionNumber));
}

// ─── 특정 버전으로 롤백 ──────────────────────────────────────────────────
export interface RollbackResult {
  success: boolean;
  rolledBackToVersion: number;
  versionTag: string;
  dnaHash: string;
  message: string;
}

export async function rollbackDna(
  packageId: string,
  targetVersionId: string,
  requestedBy: string
): Promise<RollbackResult> {
  const now = Date.now();
  const db = await getDb();
  if (!db) {
    return { success: false, rolledBackToVersion: 0, versionTag: "", dnaHash: "", message: "DB unavailable" };
  }

  // 대상 버전 조회
  const targetVersion = await db
    .select()
    .from(mipPackageVersions)
    .where(
      and(
        eq(mipPackageVersions.id, targetVersionId),
        eq(mipPackageVersions.packageId, packageId)
      )
    )
    .limit(1);

  if (targetVersion.length === 0) {
    return {
      success: false,
      rolledBackToVersion: 0,
      versionTag: "",
      dnaHash: "",
      message: "대상 버전을 찾을 수 없습니다.",
    };
  }

  const target = targetVersion[0];

  // Package의 DNA 해시를 대상 버전으로 업데이트
  await db
    .update(mipPackages)
    .set({
      dnaHash: target.dnaHash,
      patternHash: target.patternHash ?? undefined,
      contextJson: target.contextJson ?? undefined,
      status: "validated",
      validatedAt: now,
    })
    .where(eq(mipPackages.id, packageId));

  // 롤백 시각 기록
  await db
    .update(mipPackageVersions)
    .set({ rolledBackAt: now })
    .where(eq(mipPackageVersions.id, targetVersionId));

  // 롤백 자체를 새 버전으로 스냅샷 생성
  if (target.dnaSnapshot) {
    await createDnaSnapshot({
      packageId,
      userId: requestedBy,
      dnaData: JSON.parse(target.dnaSnapshot),
      patternData: target.patternSnapshot ? JSON.parse(target.patternSnapshot) : undefined,
      contextData: target.contextJson ? JSON.parse(target.contextJson) : undefined,
      didSignature: target.didSignature,
      changeReason: `롤백: v${target.versionNumber} (${target.versionTag ?? ""})으로 복원`,
      changedBy: requestedBy,
      versionTag: `rollback-to-v${target.versionNumber}`,
      isRollbackPoint: false,
    });
  }

  return {
    success: true,
    rolledBackToVersion: target.versionNumber,
    versionTag: target.versionTag ?? `v${target.versionNumber}`,
    dnaHash: target.dnaHash,
    message: `✅ DNA가 ${target.versionTag ?? `v${target.versionNumber}`}으로 성공적으로 롤백되었습니다.`,
  };
}
