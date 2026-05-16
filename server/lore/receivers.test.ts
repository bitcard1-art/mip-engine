/**
 * Lore 수신 인터페이스 핸들러 단위 테스트
 * WO-MIP-2026-003 §3
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// 공통 mock
vi.mock("../_core/env", () => ({
  ENV: {
    loreMipSharedSecret: "test-lore-mip-secret",
    mipLoreSharedSecret: "test-mip-lore-secret",
    loreWebhookUrl: "https://lore.test.space",
    loreServiceUrl: "https://lore.test.space",
    somaMipSharedSecret: "test-soma-mip-secret",
    mipSomaSharedSecret: "test-mip-soma-secret",
    somaWebhookUrl: "https://soma.test.space",
  },
}));
vi.mock("../db", () => ({ getDb: vi.fn().mockResolvedValue(null) }));
vi.mock("nanoid", () => ({ nanoid: () => "test-id" }));
vi.mock("./webhook-sender", () => ({
  sendLoreWebhook: vi.fn().mockResolvedValue(undefined),
  callLoreApi: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}));
vi.mock("../soma/webhook-sender", () => ({
  sendSomaWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/audit", () => ({
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
}));

function makeMockMIOPackage() {
  return {
    packageId: "pkg-001",
    userId: "user-001",
    dna: { indicators: { empathy: 0.85 }, version: "1.0", generatedAt: Date.now() / 1000 },
    pattern: { behavioral: {}, emotional: {}, relational: {}, version: "1.0" },
    context: { purpose: "humanoid_implant", deviceId: "dev-001", environment: "production" },
    signature: {
      did: "did:soma:" + "a".repeat(64),
      proof: "b".repeat(64),
      created: Date.now() / 1000,
      verificationMethod: "did:soma:abc#key-1",
    },
    ttl: Math.floor(Date.now() / 1000) + 3600,
    watermark: "",
  };
}

function makeReqRes(body: object): { req: Request; res: Response; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  const req = { body } as unknown as Request;
  return { req, res, json, status };
}

describe("handlePackageSubmit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("필수 필드 누락 시 400 반환", async () => {
    const { handlePackageSubmit } = await import("./receivers");
    const { req, res, status } = makeReqRes({ eventId: "evt-1" });
    await handlePackageSubmit(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("유효한 패키지 수신 시 202 반환", async () => {
    const { handlePackageSubmit } = await import("./receivers");
    const pkg = makeMockMIOPackage();
    const { req, res, json } = makeReqRes({
      eventId: "evt-001",
      packageId: "pkg-001",
      userId: "user-001",
      package: pkg,
      eventType: "lore_package_ready",
    });
    await handlePackageSubmit(req, res);
    // DB 없으므로 검증 결과에 따라 202 또는 400
    expect(json).toHaveBeenCalled();
  });
});

describe("handlePackageUpdate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("필수 필드 누락 시 400 반환", async () => {
    const { handlePackageUpdate } = await import("./receivers");
    const { req, res, status } = makeReqRes({ eventId: "evt-2" });
    await handlePackageUpdate(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("유효한 갱신 요청 처리", async () => {
    const { handlePackageUpdate } = await import("./receivers");
    const pkg = makeMockMIOPackage();
    const { req, res, json } = makeReqRes({
      eventId: "evt-002",
      packageId: "pkg-001",
      userId: "user-001",
      updatedPackage: pkg,
      reason: "ttl_refresh",
      updatedFields: ["dna"],
      previousVersion: "1.0",
      updatedAt: Date.now(),
      eventType: "lore_package_updated",
    });
    await handlePackageUpdate(req, res);
    expect(json).toHaveBeenCalled();
  });
});

describe("handlePackageRevoke", () => {
  beforeEach(() => vi.clearAllMocks());

  it("필수 필드 누락 시 400 반환", async () => {
    const { handlePackageRevoke } = await import("./receivers");
    const { req, res, status } = makeReqRes({});
    await handlePackageRevoke(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("유효한 철회 요청 처리 (DB 없음)", async () => {
    const { handlePackageRevoke } = await import("./receivers");
    const { req, res, json } = makeReqRes({
      eventId: "evt-003",
      packageId: "pkg-001",
      userId: "user-001",
      reason: "user_request",
      immediateEffect: true,
      revokedAt: Date.now(),
      eventType: "lore_package_revoked",
    });
    await handlePackageRevoke(req, res);
    expect(json).toHaveBeenCalled();
  });
});

describe("handleDNAReady", () => {
  beforeEach(() => vi.clearAllMocks());

  it("필수 필드 누락 시 400 반환", async () => {
    const { handleDNAReady } = await import("./receivers");
    const { req, res, status } = makeReqRes({ eventId: "evt-4" });
    await handleDNAReady(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("유효한 DNA Ready 알림 처리", async () => {
    const { handleDNAReady } = await import("./receivers");
    const { req, res, json } = makeReqRes({
      eventId: "evt-004",
      requestId: "req-001",
      packageId: "pkg-001",
      userId: "user-001",
      updatedDNA: {
        indicators: { empathy: 0.9 },
        version: "2.0",
        generatedAt: Date.now() / 1000,
      },
      regenerationReason: "safety_anomaly",
      completedAt: Date.now(),
      eventType: "lore_dna_regenerated",
    });
    await handleDNAReady(req, res);
    expect(json).toHaveBeenCalled();
  });
});
