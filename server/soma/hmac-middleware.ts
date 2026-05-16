/**
 * Soma → MIP HMAC-SHA256 서명 검증 미들웨어
 * WO-MIP-2026-002 §2 인증 및 보안
 */
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../_core/env";

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // ±5분

/**
 * HMAC-SHA256 서명 검증
 * message = "{serviceId}:{timestamp}:{bodyHash}"
 */
export function verifyHmacSignature(
  serviceId: string,
  timestamp: string,
  bodyHash: string,
  receivedSignature: string,
  sharedSecret: string
): boolean {
  if (!sharedSecret) return false;
  const message = `${serviceId}:${timestamp}:${bodyHash}`;
  const expected = crypto
    .createHmac("sha256", sharedSecret)
    .update(message)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Express 미들웨어: Soma → MIP 요청 HMAC 검증
 * - X-Service-ID, X-Timestamp, X-Signature 헤더 필수
 * - Replay Attack 방지 (±5분)
 */
export function somaHmacMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceId = req.headers["x-service-id"] as string;
  const timestamp = req.headers["x-timestamp"] as string;
  const signature = req.headers["x-signature"] as string;

  // 헤더 존재 확인
  if (!serviceId || !timestamp || !signature) {
    res.status(401).json({
      error: "MISSING_AUTH_HEADERS",
      message: "X-Service-ID, X-Timestamp, X-Signature 헤더가 필요합니다.",
    });
    return;
  }

  // Replay Attack 방지: ±5분 이내 요청만 허용
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > REPLAY_WINDOW_MS) {
    res.status(401).json({
      error: "TIMESTAMP_EXPIRED",
      message: "요청 시각이 허용 범위(±5분)를 초과했습니다.",
    });
    return;
  }

  // Body 해시 계산
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const bodyStr = rawBody ? rawBody.toString("utf8") : JSON.stringify(req.body);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

  // HMAC 검증
  const valid = verifyHmacSignature(
    serviceId,
    timestamp,
    bodyHash,
    signature,
    ENV.somaMipSharedSecret
  );

  if (!valid) {
    res.status(401).json({
      error: "INVALID_SIGNATURE",
      message: "HMAC 서명이 유효하지 않습니다.",
    });
    return;
  }

  next();
}

/**
 * MIP → Soma 발신용 HMAC 서명 생성
 */
export function generateSomaSignature(
  body: string,
  timestamp: string
): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", ENV.mipSomaSharedSecret)
    .update(`mip:${timestamp}:${bodyHash}`)
    .digest("hex");
}
