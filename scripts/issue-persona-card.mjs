/**
 * MIP 발급자 키쌍 생성 + 이영도 공개 명함 카드 발급
 * - Ed25519 키쌍 생성
 * - 공개키 PEM 출력 (ISSUER_PUBLIC_KEY_PEM)
 * - 이영도 명함 카드 서명 후 출력 (ISSUER_SIGNED_CARD)
 * - 개인키는 MIP 내부 보관용으로만 출력 (전달 금지)
 */
import crypto from "crypto";

// ─── 1. Ed25519 키쌍 생성 ─────────────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// ─── 2. 이영도 공개 명함 카드 페이로드 ────────────────────────────────────────
const personaCard = {
  version: "1.0",
  type: "persona-card",
  issuer: "did:mip:issuer:mip-engine-v1",
  subject: {
    did: "did:mip:persona:lee-youngdo",
    displayName: "이영도",
    title: "MIP Engine Architect",
    organization: "SOMA Labs",
    bio: "MIO Implantation Protocol 설계 및 PSDI v2.0 아키텍처 총괄",
  },
  capabilities: [
    "mip:admin",
    "mip:implant:approve",
    "mip:policy:manage",
    "mip:decision-core:execute",
    "mip:audit:read",
  ],
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1년
};

// ─── 3. 서명 생성 ─────────────────────────────────────────────────────────────
const payloadBytes = Buffer.from(JSON.stringify(personaCard), "utf8");
const signature = crypto.sign(null, payloadBytes, privateKey);
const signatureBase64 = signature.toString("base64");

// ─── 4. 서명 포함 카드 (최종 산출물) ──────────────────────────────────────────
const signedCard = {
  payload: personaCard,
  signature: signatureBase64,
  algorithm: "Ed25519",
  publicKeyPem: publicKey.trim(),
};

// ─── 5. 검증 테스트 ──────────────────────────────────────────────────────────
const pubKeyObj = crypto.createPublicKey(publicKey);
const isValid = crypto.verify(null, payloadBytes, pubKeyObj, signature);

// ─── 출력 ─────────────────────────────────────────────────────────────────────
console.log("═".repeat(70));
console.log("  [1] ISSUER_PUBLIC_KEY_PEM (panc.mysoma.space 환경변수)");
console.log("═".repeat(70));
console.log(publicKey.trim());

console.log("\n" + "═".repeat(70));
console.log("  [2] ISSUER_SIGNED_CARD (panc.mysoma.space 환경변수)");
console.log("═".repeat(70));
const signedCardJson = JSON.stringify(signedCard);
console.log(signedCardJson);

console.log("\n" + "═".repeat(70));
console.log("  [검증 결과]");
console.log("═".repeat(70));
console.log(`  서명 검증: ${isValid ? "✅ PASS" : "❌ FAIL"}`);
console.log(`  발급 시각: ${personaCard.issuedAt}`);
console.log(`  만료 시각: ${personaCard.expiresAt}`);
console.log(`  Subject DID: ${personaCard.subject.did}`);

console.log("\n" + "═".repeat(70));
console.log("  [MIP 내부 보관용 — 절대 외부 전달 금지]");
console.log("═".repeat(70));
console.log(privateKey.trim());
