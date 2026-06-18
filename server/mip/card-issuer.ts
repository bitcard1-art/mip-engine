/**
 * MIP Persona Card Issuer
 * Ed25519 서명으로 페르소나 카드를 발급하는 서비스
 */
import crypto from "crypto";
import { ENV } from "../_core/env";

export interface PersonaCardPayload {
  version: string;
  type: "persona-card";
  issuer: string;
  subject: {
    did: string;
    displayName: string;
    title?: string;
    organization?: string;
    bio?: string;
  };
  capabilities: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface SignedPersonaCard {
  payload: PersonaCardPayload;
  signature: string; // Base64
  algorithm: "Ed25519";
  publicKeyPem: string;
}

const ISSUER_DID = "did:mip:issuer:mip-engine-v1";

/**
 * 페르소나 카드 발급 (Ed25519 서명)
 */
export function issuePersonaCard(params: {
  subjectDid: string;
  displayName: string;
  title?: string;
  organization?: string;
  bio?: string;
  capabilities: string[];
  expiresInDays?: number;
}): SignedPersonaCard {
  const privateKeyPem = ENV.mipIssuerPrivateKey;
  if (!privateKeyPem || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("MIP_ISSUER_PRIVATE_KEY is not configured");
  }

  const now = new Date();
  const expiresInDays = params.expiresInDays ?? 365;
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  const payload: PersonaCardPayload = {
    version: "1.0",
    type: "persona-card",
    issuer: ISSUER_DID,
    subject: {
      did: params.subjectDid,
      displayName: params.displayName,
      ...(params.title && { title: params.title }),
      ...(params.organization && { organization: params.organization }),
      ...(params.bio && { bio: params.bio }),
    },
    capabilities: params.capabilities,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Ed25519 서명
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = crypto.sign(null, payloadBytes, privateKey);

  // 공개키 추출
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  return {
    payload,
    signature: signature.toString("base64"),
    algorithm: "Ed25519",
    publicKeyPem: publicKeyPem.trim(),
  };
}

/**
 * 서명된 카드 검증
 */
export function verifyPersonaCard(card: SignedPersonaCard): boolean {
  try {
    const publicKey = crypto.createPublicKey(card.publicKeyPem);
    const payloadBytes = Buffer.from(JSON.stringify(card.payload), "utf8");
    const signature = Buffer.from(card.signature, "base64");
    return crypto.verify(null, payloadBytes, publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * 발급자 공개키 PEM 반환 (외부 서비스에 전달용)
 */
export function getIssuerPublicKeyPem(): string {
  const privateKeyPem = ENV.mipIssuerPrivateKey;
  if (!privateKeyPem || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("MIP_ISSUER_PRIVATE_KEY is not configured");
  }
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);
  return (publicKey.export({ type: "spki", format: "pem" }) as string).trim();
}
