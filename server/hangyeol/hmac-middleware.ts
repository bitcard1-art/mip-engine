/**
 * 한결(Hangyeol) → MIP HMAC-SHA256 서명 검증 미들웨어
 * 서버-투-서버 인증: X-Service-ID: hangyeol
 */
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../_core/env";

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // ±5분

export function verifyHangyeolSignature(
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

export function hangyeolHmacMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceId = req.headers["x-service-id"] as string;
  const timestamp = req.headers["x-timestamp"] as string;
  const signature = req.headers["x-signature"] as string;

  if (!serviceId || !timestamp || !signature) {
    res.status(401).json({
      error: "MISSING_AUTH_HEADERS",
      message: "X-Service-ID, X-Timestamp, X-Signature 헤더가 필요합니다.",
    });
    return;
  }

  if (serviceId !== "hangyeol") {
    res.status(401).json({
      error: "INVALID_SERVICE_ID",
      message: "X-Service-ID는 'hangyeol'이어야 합니다.",
    });
    return;
  }

  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > REPLAY_WINDOW_MS) {
    res.status(401).json({
      error: "TIMESTAMP_EXPIRED",
      message: "요청 시각이 허용 범위(±5분)를 초과했습니다.",
    });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const bodyStr = rawBody ? rawBody.toString("utf8") : (req.body !== undefined ? JSON.stringify(req.body) : "");
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

  const valid = verifyHangyeolSignature(
    serviceId,
    timestamp,
    bodyHash,
    signature,
    ENV.hangyeolMipSharedSecret
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
 * MIP → 한결 발신용 HMAC 서명 생성
 */
export function generateHangyeolSignature(
  body: string,
  timestamp: string
): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", ENV.mipHangyeolSharedSecret)
    .update(`mip:${timestamp}:${bodyHash}`)
    .digest("hex");
}
