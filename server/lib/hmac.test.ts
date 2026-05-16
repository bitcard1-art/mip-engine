import { describe, it, expect } from "vitest";
import {
  generateHmacSignature,
  verifyHmacSignature,
  generateWatermark,
  verifyHmacHeader,
} from "./hmac";

describe("HMAC Utilities", () => {
  const secret = "test-secret-key-for-mip-engine";
  const payload = JSON.stringify({ userId: "user-001", packageId: "pkg-001", timestamp: 1700000000000 });

  describe("generateHmacSignature", () => {
    it("should generate a non-empty HMAC signature", () => {
      const sig = generateHmacSignature(payload, secret);
      expect(sig).toBeTruthy();
      expect(typeof sig).toBe("string");
      expect(sig.length).toBeGreaterThan(0);
    });

    it("should generate consistent signatures for the same input", () => {
      const sig1 = generateHmacSignature(payload, secret);
      const sig2 = generateHmacSignature(payload, secret);
      expect(sig1).toBe(sig2);
    });

    it("should generate different signatures for different payloads", () => {
      const sig1 = generateHmacSignature(payload, secret);
      const sig2 = generateHmacSignature("different payload", secret);
      expect(sig1).not.toBe(sig2);
    });

    it("should generate different signatures for different secrets", () => {
      const sig1 = generateHmacSignature(payload, secret);
      const sig2 = generateHmacSignature(payload, "different-secret");
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("verifyHmacSignature", () => {
    it("should return true for a valid signature", () => {
      const sig = generateHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload, sig, secret)).toBe(true);
    });

    it("should return false for an invalid signature", () => {
      expect(verifyHmacSignature(payload, "invalid-signature", secret)).toBe(false);
    });

    it("should return false for a tampered payload", () => {
      const sig = generateHmacSignature(payload, secret);
      const tamperedPayload = payload + "tampered";
      expect(verifyHmacSignature(tamperedPayload, sig, secret)).toBe(false);
    });
  });

  describe("generateWatermark", () => {
    it("should generate a watermark with required fields", () => {
      const wm = generateWatermark("pkg-001", "user-001");
      expect(wm).toHaveProperty("packageId", "pkg-001");
      expect(wm).toHaveProperty("userId", "user-001");
      expect(wm).toHaveProperty("timestamp");
      expect(wm).toHaveProperty("signature");
      expect(wm).toHaveProperty("nonce");
    });

    it("should generate unique nonces for each watermark", () => {
      const wm1 = generateWatermark("pkg-001", "user-001");
      const wm2 = generateWatermark("pkg-001", "user-001");
      expect(wm1.nonce).not.toBe(wm2.nonce);
    });
  });

  describe("verifyHmacHeader", () => {
    it("should return valid=true for a correct HMAC header", () => {
      const body = '{"test":"data"}';
      const timestamp = Date.now().toString();
      const sig = generateHmacSignature(`${timestamp}.${body}`, secret);
      const result = verifyHmacHeader(`t=${timestamp},v1=${sig}`, body, secret);
      expect(result.valid).toBe(true);
    });

    it("should return valid=false for missing header", () => {
      const result = verifyHmacHeader("", '{"test":"data"}', secret);
      expect(result.valid).toBe(false);
    });

    it("should return valid=false for an expired timestamp", () => {
      const body = '{"test":"data"}';
      const oldTimestamp = (Date.now() - 400000).toString(); // 6+ minutes ago
      const sig = generateHmacSignature(`${oldTimestamp}.${body}`, secret);
      const result = verifyHmacHeader(`t=${oldTimestamp},v1=${sig}`, body, secret);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("만료");
    });
  });
});
