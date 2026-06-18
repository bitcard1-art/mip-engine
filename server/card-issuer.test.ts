import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("MIP_ISSUER_PRIVATE_KEY", () => {
  it("should be a valid Ed25519 private key that can sign and verify", () => {
    const rawPem = process.env.MIP_ISSUER_PRIVATE_KEY;
    expect(rawPem).toBeDefined();
    // Handle escaped newlines from env
    const pem = rawPem!.replace(/\\n/g, "\n");
    expect(pem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(pem).toContain("-----END PRIVATE KEY-----");

    // Create key object from PEM
    const privateKey = crypto.createPrivateKey(pem!);
    expect(privateKey.type).toBe("private");
    expect(privateKey.asymmetricKeyType).toBe("ed25519");

    // Derive public key
    const publicKey = crypto.createPublicKey(privateKey);
    expect(publicKey.type).toBe("public");

    // Sign a test payload
    const testPayload = Buffer.from(JSON.stringify({ test: "persona-card" }));
    const signature = crypto.sign(null, testPayload, privateKey);
    expect(signature).toBeInstanceOf(Buffer);
    expect(signature.length).toBeGreaterThan(0);

    // Verify signature
    const isValid = crypto.verify(null, testPayload, publicKey, signature);
    expect(isValid).toBe(true);

    // Verify public key matches expected (from issued card)
    const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    expect(pubPem).toContain("MCowBQYDK2VwAyEAbcp9aO0wCDCcPgyvADtnSt6h2TnT6tgm09UG+Uiuvig=");
  });
});
