import { createHmac, createHash, timingSafeEqual, randomBytes } from "crypto";
import { nanoid } from "nanoid";

const HMAC_SECRET = process.env.MIP_HMAC_SECRET || "mip-engine-hmac-secret-key-2026";
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5분

/**
 * HMAC-SHA256 서명 생성
 * PSDI §9 수식 20 기반 워터마크 생성
 */
export function generateHmacSignature(payload: string, secret?: string): string {
  return createHmac("sha256", secret || HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * HMAC-SHA256 서명 검증 (타이밍 공격 방지)
 */
export function verifyHmacSignature(payload: string, signature: string, secret?: string): boolean {
  try {
    const expected = generateHmacSignature(payload, secret || HMAC_SECRET);
    const expectedBuf = Buffer.from(expected, "hex");
    const signatureBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

/**
 * MIO Package HMAC 워터마크 생성
 * packageId + userId + ttl 조합으로 워터마크 생성
 */
export function generatePackageWatermark(packageId: string, userId: string, ttl: number): string {
  const payload = `${packageId}:${userId}:${ttl}`;
  return generateHmacSignature(payload);
}

/**
 * 워터마크 객체 생성 (nonce 포함)
 */
export function generateWatermark(packageId: string, userId: string): {
  packageId: string;
  userId: string;
  timestamp: number;
  signature: string;
  nonce: string;
} {
  const timestamp = Date.now();
  const nonce = nanoid();
  const payload = `${packageId}:${userId}:${timestamp}:${nonce}`;
  const signature = generateHmacSignature(payload);
  return { packageId, userId, timestamp, signature, nonce };
}

/**
 * SHA-256 해시 생성 (감사 체인용)
 */
export function sha256Hash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * 감사 체인 해시 생성 (이전 해시 + 현재 데이터)
 */
export function generateChainHash(previousHash: string | null, data: string): string {
  const input = `${previousHash || "genesis"}:${data}`;
  return sha256Hash(input);
}

/**
 * HTTP 요청 HMAC 서명 헤더 파싱 및 검증
 * 형식: t={timestamp},v1={signature}
 * 타임스탬프 기반 재전송 공격 방지 포함
 */
export function verifyHmacHeader(
  header: string | undefined,
  body: string,
  secret?: string
): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "헤더 없음" };

  // t={timestamp},v1={signature} 형식 파싱
  const tMatch = header.match(/t=(\d+)/);
  const v1Match = header.match(/v1=([a-f0-9]+)/);

  if (!tMatch || !v1Match) {
    // 레거시 HMAC-SHA256 형식 지원
    const legacyMatch = header.match(/^HMAC-SHA256\s+(.+)$/);
    if (legacyMatch && legacyMatch[1]) {
      const valid = verifyHmacSignature(body, legacyMatch[1], secret || HMAC_SECRET);
      return { valid };
    }
    return { valid: false, reason: "잘못된 헤더 형식" };
  }

  const timestamp = parseInt(tMatch[1], 10);
  const signature = v1Match[1];

  // 타임스탬프 유효성 검사 (5분 이내)
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, reason: "타임스탬프 만료됨" };
  }

  // 서명 검증: timestamp.body
  const signedPayload = `${timestamp}.${body}`;
  const valid = verifyHmacSignature(signedPayload, signature, secret || HMAC_SECRET);
  return { valid, reason: valid ? undefined : "서명 불일치" };
}
