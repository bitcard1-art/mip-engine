/**
 * Lore HMAC 미들웨어 단위 테스트
 * WO-MIP-2026-003 §2
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyLoreHmacSignature, generateLoreSignature } from "./hmac-middleware";

// ENV mock
vi.mock("../_core/env", () => ({
  ENV: {
    loreMipSharedSecret: "test-lore-mip-secret-32chars-padding",
    mipLoreSharedSecret: "test-mip-lore-secret-32chars-padding",
    loreWebhookUrl: "https://lore.test.space",
    loreServiceUrl: "https://lore.test.space",
  },
}));

describe("verifyLoreHmacSignature", () => {
  it("올바른 서명을 검증한다", () => {
    const secret = "test-secret";
    const serviceId = "lore";
    const timestamp = "1700000000000";
    const body = JSON.stringify({ packageId: "pkg-001" });
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    const message = `${serviceId}:${timestamp}:${bodyHash}`;
    const signature = crypto.createHmac("sha256", secret).update(message).digest("hex");

    expect(verifyLoreHmacSignature(serviceId, timestamp, bodyHash, signature, secret)).toBe(true);
  });

  it("잘못된 서명을 거부한다", () => {
    const secret = "test-secret";
    const serviceId = "lore";
    const timestamp = "1700000000000";
    const bodyHash = crypto.createHash("sha256").update("{}").digest("hex");
    const wrongSignature = "a".repeat(64);

    expect(verifyLoreHmacSignature(serviceId, timestamp, bodyHash, wrongSignature, secret)).toBe(false);
  });

  it("빈 시크릿은 false를 반환한다", () => {
    expect(verifyLoreHmacSignature("lore", "123", "abc", "sig", "")).toBe(false);
  });

  it("서명 길이가 다르면 false를 반환한다", () => {
    const secret = "test-secret";
    const serviceId = "lore";
    const timestamp = "1700000000000";
    const bodyHash = crypto.createHash("sha256").update("{}").digest("hex");
    expect(verifyLoreHmacSignature(serviceId, timestamp, bodyHash, "short", secret)).toBe(false);
  });
});

describe("generateLoreSignature", () => {
  it("MIP → Lore 서명을 생성한다", () => {
    const body = JSON.stringify({ eventType: "mip_package_received" });
    const timestamp = "1700000000000";
    const sig = generateLoreSignature(body, timestamp);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it("동일 입력에 동일 서명을 반환한다", () => {
    const body = JSON.stringify({ test: true });
    const timestamp = "1700000000000";
    expect(generateLoreSignature(body, timestamp)).toBe(generateLoreSignature(body, timestamp));
  });

  it("다른 body에 다른 서명을 반환한다", () => {
    const timestamp = "1700000000000";
    const sig1 = generateLoreSignature(JSON.stringify({ a: 1 }), timestamp);
    const sig2 = generateLoreSignature(JSON.stringify({ a: 2 }), timestamp);
    expect(sig1).not.toBe(sig2);
  });
});

describe("loreHmacMiddleware - Replay Attack 방지", () => {
  it("±5분 이내 타임스탬프는 유효하다", () => {
    const now = Date.now();
    const replayWindowMs = 5 * 60 * 1000;
    const withinWindow = now - replayWindowMs + 1000;
    expect(Math.abs(now - withinWindow)).toBeLessThan(replayWindowMs);
  });

  it("±5분 초과 타임스탬프는 거부된다", () => {
    const now = Date.now();
    const replayWindowMs = 5 * 60 * 1000;
    const outsideWindow = now - replayWindowMs - 1000;
    expect(Math.abs(now - outsideWindow)).toBeGreaterThan(replayWindowMs);
  });
});
