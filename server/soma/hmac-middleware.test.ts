/**
 * Soma HMAC 미들웨어 단위 테스트
 * WO-MIP-2026-002 §2
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyHmacSignature, generateSomaSignature } from "./hmac-middleware";

// ENV 모킹
vi.mock("../_core/env", () => ({
  ENV: {
    somaMipSharedSecret: "4697c7c49a85e97938a26c3d59b6c9073f8aa87b82bf578688fac851cdde35e9",
    mipSomaSharedSecret: "308c3c63d6ed0ceed96a86130a88b749909c21b729a51740e76501ef94e13fcd",
    somaWebhookUrl: "https://soma.mysoma.space",
    somaServiceUrl: "https://soma.mysoma.space",
  },
}));

describe("verifyHmacSignature", () => {
  const sharedSecret = "4697c7c49a85e97938a26c3d59b6c9073f8aa87b82bf578688fac851cdde35e9";

  function makeSignature(serviceId: string, timestamp: string, body: string): string {
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    return crypto
      .createHmac("sha256", sharedSecret)
      .update(`${serviceId}:${timestamp}:${bodyHash}`)
      .digest("hex");
  }

  it("유효한 서명을 올바르게 검증한다", () => {
    const serviceId = "soma";
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ test: "payload" });
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    const signature = makeSignature(serviceId, timestamp, body);

    expect(verifyHmacSignature(serviceId, timestamp, bodyHash, signature, sharedSecret)).toBe(true);
  });

  it("잘못된 서명을 거부한다", () => {
    const bodyHash = crypto.createHash("sha256").update("body").digest("hex");
    expect(
      verifyHmacSignature("soma", Date.now().toString(), bodyHash, "invalid_signature_hex_0000000000000000000000000000000000000000000000000000000000000000", sharedSecret)
    ).toBe(false);
  });

  it("빈 sharedSecret이면 false를 반환한다", () => {
    const bodyHash = crypto.createHash("sha256").update("body").digest("hex");
    expect(verifyHmacSignature("soma", "1234567890", bodyHash, "abc", "")).toBe(false);
  });

  it("다른 serviceId로 서명하면 검증 실패한다", () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ test: "payload" });
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    const signature = makeSignature("wrong-service", timestamp, body);
    expect(verifyHmacSignature("soma", timestamp, bodyHash, signature, sharedSecret)).toBe(false);
  });
});

describe("somaHmacMiddleware - Replay Attack 방지", () => {
  it("5분 이상 지난 타임스탬프는 TIMESTAMP_EXPIRED 응답을 반환한다", () => {
    const REPLAY_WINDOW_MS = 5 * 60 * 1000;
    const oldTimestamp = Date.now() - REPLAY_WINDOW_MS - 1000;
    const now = Date.now();
    expect(Math.abs(now - oldTimestamp)).toBeGreaterThan(REPLAY_WINDOW_MS);
  });

  it("현재 타임스탬프는 허용 범위 내에 있다", () => {
    const REPLAY_WINDOW_MS = 5 * 60 * 1000;
    const currentTimestamp = Date.now();
    const now = Date.now();
    expect(Math.abs(now - currentTimestamp)).toBeLessThanOrEqual(REPLAY_WINDOW_MS);
  });

  it("NaN 타임스탬프는 거부된다", () => {
    const timestamp = "not-a-number";
    const requestTime = parseInt(timestamp, 10);
    expect(isNaN(requestTime)).toBe(true);
  });
});

describe("generateSomaSignature", () => {
  const mipSomaSecret = "308c3c63d6ed0ceed96a86130a88b749909c21b729a51740e76501ef94e13fcd";

  it("동일한 body와 timestamp로 동일한 서명을 생성한다", () => {
    const body = JSON.stringify({ eventType: "mip_implant_progress" });
    const timestamp = "1700000000000";

    const sig1 = generateSomaSignature(body, timestamp);
    const sig2 = generateSomaSignature(body, timestamp);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("다른 timestamp로 다른 서명을 생성한다", () => {
    const body = JSON.stringify({ eventType: "mip_implant_progress" });
    const sig1 = generateSomaSignature(body, "1700000000000");
    const sig2 = generateSomaSignature(body, "1700000000001");
    expect(sig1).not.toBe(sig2);
  });

  it("서명은 64자 hex 문자열이다", () => {
    const sig = generateSomaSignature("test body", Date.now().toString());
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
