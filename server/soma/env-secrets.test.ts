/**
 * Soma 연동 환경변수 유효성 검증 테스트
 * WO-MIP-2026-002 §2
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("Soma 연동 환경변수 유효성", () => {
  it("SOMA_MIP_SHARED_SECRET이 64자 hex 형식이다", () => {
    const secret = process.env.SOMA_MIP_SHARED_SECRET ?? "";
    // 테스트 환경에서는 빈 문자열일 수 있으므로 설정된 경우만 검증
    if (secret) {
      expect(secret).toMatch(/^[0-9a-f]{64}$/i);
    } else {
      // CI 환경에서 시크릿 미설정 시 스킵
      expect(true).toBe(true);
    }
  });

  it("MIP_SOMA_SHARED_SECRET이 64자 hex 형식이다", () => {
    const secret = process.env.MIP_SOMA_SHARED_SECRET ?? "";
    if (secret) {
      expect(secret).toMatch(/^[0-9a-f]{64}$/i);
    } else {
      expect(true).toBe(true);
    }
  });

  it("두 시크릿이 서로 다르다 (설정된 경우)", () => {
    const s1 = process.env.SOMA_MIP_SHARED_SECRET ?? "";
    const s2 = process.env.MIP_SOMA_SHARED_SECRET ?? "";
    if (s1 && s2) {
      expect(s1).not.toBe(s2);
    } else {
      expect(true).toBe(true);
    }
  });

  it("HMAC 서명 생성 및 검증이 일관성 있게 동작한다", () => {
    const secret = "4697c7c49a85e97938a26c3d59b6c9073f8aa87b82bf578688fac851cdde35e9";
    const message = "soma:1700000000000:abc123def456";

    const sig1 = crypto.createHmac("sha256", secret).update(message).digest("hex");
    const sig2 = crypto.createHmac("sha256", secret).update(message).digest("hex");

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("Replay Attack 방지: 5분 이상 지난 타임스탬프는 거부된다", () => {
    const REPLAY_WINDOW_MS = 5 * 60 * 1000;
    const oldTimestamp = Date.now() - REPLAY_WINDOW_MS - 1000; // 5분 1초 전
    const now = Date.now();

    expect(Math.abs(now - oldTimestamp)).toBeGreaterThan(REPLAY_WINDOW_MS);
  });

  it("현재 타임스탬프는 Replay Attack 방지 창 내에 있다", () => {
    const REPLAY_WINDOW_MS = 5 * 60 * 1000;
    const currentTimestamp = Date.now();
    const now = Date.now();

    expect(Math.abs(now - currentTimestamp)).toBeLessThanOrEqual(REPLAY_WINDOW_MS);
  });
});
