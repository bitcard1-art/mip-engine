import { describe, it, expect } from "vitest";
import { issuePersonaCard, verifyPersonaCard, getIssuerPublicKeyPem } from "./mip/card-issuer";

describe("Card Issuer Service", () => {
  it("should issue a valid signed persona card", () => {
    const card = issuePersonaCard({
      subjectDid: "did:persona:0OC8fQ2nuF",
      displayName: "이은실",
      title: "AI Researcher",
      organization: "SOMA Labs",
      bio: "테스트 페르소나",
      capabilities: ["mip:read", "mip:decision-core:execute"],
      expiresInDays: 365,
    });

    expect(card.payload.version).toBe("1.0");
    expect(card.payload.type).toBe("persona-card");
    expect(card.payload.issuer).toBe("did:mip:issuer:mip-engine-v1");
    expect(card.payload.subject.did).toBe("did:persona:0OC8fQ2nuF");
    expect(card.payload.subject.displayName).toBe("이은실");
    expect(card.payload.capabilities).toContain("mip:read");
    expect(card.algorithm).toBe("Ed25519");
    expect(card.signature).toBeTruthy();
    expect(card.publicKeyPem).toContain("PUBLIC KEY");
  });

  it("should verify a valid card signature", () => {
    const card = issuePersonaCard({
      subjectDid: "did:persona:test123",
      displayName: "테스트",
      capabilities: ["mip:read"],
    });

    const isValid = verifyPersonaCard(card);
    expect(isValid).toBe(true);
  });

  it("should reject a tampered card", () => {
    const card = issuePersonaCard({
      subjectDid: "did:persona:test123",
      displayName: "테스트",
      capabilities: ["mip:read"],
    });

    // Tamper with payload
    const tampered = { ...card, payload: { ...card.payload, subject: { ...card.payload.subject, displayName: "해커" } } };
    const isValid = verifyPersonaCard(tampered);
    expect(isValid).toBe(false);
  });

  it("should return consistent public key", () => {
    const pubKey = getIssuerPublicKeyPem();
    expect(pubKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(pubKey).toContain("-----END PUBLIC KEY-----");

    // Issue two cards and verify same public key
    const card1 = issuePersonaCard({ subjectDid: "did:a", displayName: "A", capabilities: ["x"] });
    const card2 = issuePersonaCard({ subjectDid: "did:b", displayName: "B", capabilities: ["y"] });
    expect(card1.publicKeyPem).toBe(card2.publicKeyPem);
    expect(card1.publicKeyPem).toBe(pubKey);
  });

  it("should set correct expiry based on expiresInDays", () => {
    const card = issuePersonaCard({
      subjectDid: "did:persona:expiry-test",
      displayName: "만료테스트",
      capabilities: ["mip:read"],
      expiresInDays: 30,
    });

    const issuedAt = new Date(card.payload.issuedAt).getTime();
    const expiresAt = new Date(card.payload.expiresAt).getTime();
    const diffDays = (expiresAt - issuedAt) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(30);
  });
});
