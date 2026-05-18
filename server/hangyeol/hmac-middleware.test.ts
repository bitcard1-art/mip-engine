import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyHangyeolSignature } from "./hmac-middleware";

describe("Hangyeol HMAC Middleware — HANGYEOL_MIP_SHARED_SECRET 검증", () => {
  const sharedSecret = process.env.HANGYEOL_MIP_SHARED_SECRET || "";

  it("HANGYEOL_MIP_SHARED_SECRET 환경변수가 설정되어 있어야 한다", () => {
    expect(sharedSecret).toBeTruthy();
    expect(sharedSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("올바른 시크릿으로 서명하면 검증이 통과해야 한다", () => {
    const serviceId = "hangyeol";
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ action: "test", deviceId: "AF17B6474WZN" });
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");

    // 한결 서비스가 서명 생성하는 방식 시뮬레이션
    const message = `${serviceId}:${timestamp}:${bodyHash}`;
    const signature = crypto
      .createHmac("sha256", sharedSecret)
      .update(message)
      .digest("hex");

    const result = verifyHangyeolSignature(
      serviceId,
      timestamp,
      bodyHash,
      signature,
      sharedSecret
    );
    expect(result).toBe(true);
  });

  it("잘못된 시크릿으로 서명하면 검증이 실패해야 한다", () => {
    const serviceId = "hangyeol";
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ action: "test", deviceId: "KQ65QC88AF" });
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");

    const wrongSecret = "wrong_secret_value_1234567890abcdef";
    const message = `${serviceId}:${timestamp}:${bodyHash}`;
    const signature = crypto
      .createHmac("sha256", wrongSecret)
      .update(message)
      .digest("hex");

    const result = verifyHangyeolSignature(
      serviceId,
      timestamp,
      bodyHash,
      signature,
      sharedSecret
    );
    expect(result).toBe(false);
  });

  it("시크릿 값이 5a22f117로 시작해야 한다 (한결 서비스와 동일)", () => {
    expect(sharedSecret.startsWith("5a22f117")).toBe(true);
  });
});
