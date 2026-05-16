import { describe, it, expect } from "vitest";
import {
  validateDIDFormat,
  generateDIDDocument,
  verifyDIDSignature,
  extractDIDMethod,
} from "./did";

describe("DID Utilities", () => {
  describe("validateDIDFormat", () => {
    it("should validate correct DID format", () => {
      expect(validateDIDFormat("did:soma:abc123")).toBe(true);
      expect(validateDIDFormat("did:web:example.com")).toBe(true);
      expect(validateDIDFormat("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")).toBe(true);
    });

    it("should reject invalid DID format", () => {
      expect(validateDIDFormat("not-a-did")).toBe(false);
      expect(validateDIDFormat("did:")).toBe(false);
      expect(validateDIDFormat("")).toBe(false);
      expect(validateDIDFormat("http://example.com")).toBe(false);
    });
  });

  describe("generateDIDDocument", () => {
    it("should generate a DID document with required fields", () => {
      const doc = generateDIDDocument("did:soma:test-device-001");
      expect(doc).toHaveProperty("@context");
      expect(doc).toHaveProperty("id", "did:soma:test-device-001");
      expect(doc).toHaveProperty("verificationMethod");
      expect(doc).toHaveProperty("authentication");
      expect(Array.isArray(doc.verificationMethod)).toBe(true);
    });

    it("should include a verification method with publicKeyJwk", () => {
      const doc = generateDIDDocument("did:soma:test-device-002");
      const vm = doc.verificationMethod[0];
      expect(vm).toHaveProperty("id");
      expect(vm).toHaveProperty("type");
      expect(vm).toHaveProperty("controller");
      expect(vm).toHaveProperty("publicKeyJwk");
    });
  });

  describe("verifyDIDSignature", () => {
    it("should return false for invalid verificationMethod format", () => {
      const result = verifyDIDSignature(
        "did:soma:test",
        "mock-proof-data",
        "test-data",
        "invalid-vm-no-hash" // # 없는 잘못된 verificationMethod
      );
      expect(result.valid).toBe(false);
    });

    it("should return a result with valid field", () => {
      const result = verifyDIDSignature(
        "did:soma:test",
        "mock-proof-data",
        "test-data",
        "did:soma:test#key-1"
      );
      expect(result).toHaveProperty("valid");
      expect(typeof result.valid).toBe("boolean");
    });
  });

  describe("extractDIDMethod", () => {
    it("should extract method from DID", () => {
      expect(extractDIDMethod("did:soma:abc123")).toBe("soma");
      expect(extractDIDMethod("did:web:example.com")).toBe("web");
      expect(extractDIDMethod("did:key:z6Mk")).toBe("key");
    });

    it("should return null for invalid DID", () => {
      expect(extractDIDMethod("not-a-did")).toBeNull();
      expect(extractDIDMethod("")).toBeNull();
    });
  });
});
