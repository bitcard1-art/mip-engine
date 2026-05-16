import { sha256Hash, generateChainHash } from "./hmac";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { mipAuditChain } from "../../drizzle/schema";
import { desc } from "drizzle-orm";

export type AuditEntityType =
  | "implantation"
  | "device"
  | "package"
  | "sandbox_report"
  | "safety_log"
  | "policy"
  | "session";

export interface AuditEntry {
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  actorId: string;
  data: Record<string, unknown>;
}

/**
 * 감사 로그 해시 체인에 새 항목 추가
 * 이전 체인 해시와 현재 데이터를 결합하여 무결성 보장
 */
export async function appendAuditChain(entry: AuditEntry): Promise<string> {
  const db = await getDb();
  if (!db) {
    console.warn("[Audit] DB not available, skipping audit chain entry");
    return "";
  }

  try {
    // 마지막 체인 항목 조회
    const lastEntry = await db
      .select()
      .from(mipAuditChain)
      .orderBy(desc(mipAuditChain.sequenceNumber))
      .limit(1);

    const previousHash = lastEntry.length > 0 ? lastEntry[0].chainHash : null;
    const sequenceNumber = lastEntry.length > 0 ? lastEntry[0].sequenceNumber + 1 : 1;

    // 데이터 해시 생성
    const dataHash = sha256Hash(JSON.stringify(entry.data));

    // 체인 해시 생성 (이전 해시 + 현재 데이터 해시)
    const chainHash = generateChainHash(previousHash, dataHash);

    const id = nanoid();
    const timestamp = Date.now();

    await db.insert(mipAuditChain).values({
      id,
      sequenceNumber,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId,
      dataHash,
      previousHash: previousHash ?? undefined,
      chainHash,
      timestamp,
    });

    return chainHash;
  } catch (err) {
    console.error("[Audit] Failed to append audit chain:", err);
    return "";
  }
}

/**
 * 감사 체인 무결성 검증
 */
export async function verifyAuditChain(): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
}> {
  const db = await getDb();
  if (!db) return { valid: false, totalEntries: 0 };

  const entries = await db
    .select()
    .from(mipAuditChain)
    .orderBy(mipAuditChain.sequenceNumber);

  if (entries.length === 0) return { valid: true, totalEntries: 0 };

  let previousHash: string | null = null;

  for (const entry of entries) {
    const expectedChainHash = generateChainHash(previousHash, entry.dataHash);
    if (expectedChainHash !== entry.chainHash) {
      return { valid: false, brokenAt: entry.sequenceNumber, totalEntries: entries.length };
    }
    previousHash = entry.chainHash;
  }

  return { valid: true, totalEntries: entries.length };
}

/**
 * 감사 로그 목록 조회
 */
export async function getAuditLogs(limit = 50): Promise<Array<{
  id: string;
  sequenceNumber: number;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  hash: string;
  timestamp: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const entries = await db
      .select()
      .from(mipAuditChain)
      .orderBy(desc(mipAuditChain.sequenceNumber))
      .limit(limit);

    return entries.map((e) => ({
      id: e.id,
      sequenceNumber: e.sequenceNumber,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      actorId: e.actorId,
      hash: e.chainHash,
      timestamp: e.timestamp,
    }));
  } catch (err) {
    console.error("[Audit] Failed to get audit logs:", err);
    return [];
  }
}
