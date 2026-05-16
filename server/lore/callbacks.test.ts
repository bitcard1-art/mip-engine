/**
 * Lore 발신 콜백 단위 테스트
 * WO-MIP-2026-003 §4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../_core/env", () => ({
  ENV: {
    loreMipSharedSecret: "test-lore-mip-secret",
    mipLoreSharedSecret: "test-mip-lore-secret",
    loreWebhookUrl: "https://lore.test.space",
    loreServiceUrl: "https://lore.test.space",
  },
}));
vi.mock("../db", () => ({ getDb: vi.fn().mockResolvedValue(null) }));
vi.mock("nanoid", () => ({ nanoid: () => "test-id" }));
vi.mock("./webhook-sender", () => ({
  sendLoreWebhook: vi.fn().mockResolvedValue(undefined),
  callLoreApi: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { estimatedCompletionMs: 30000 } }),
}));
vi.mock("../lib/audit", () => ({
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
}));

describe("notifyPackageReceived", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sendLoreWebhook을 mip_package_received 이벤트로 호출한다", async () => {
    const { notifyPackageReceived } = await import("./callbacks");
    const { sendLoreWebhook } = await import("./webhook-sender");
    await notifyPackageReceived({
      packageId: "pkg-001",
      userId: "user-001",
      watermark: "wm-abc123",
      validUntil: Date.now() + 3600000,
    });
    expect(sendLoreWebhook).toHaveBeenCalledWith(
      "mip_package_received",
      expect.objectContaining({ packageId: "pkg-001", watermark: "wm-abc123" })
    );
  });
});

describe("notifyPackageValidationFailed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DID_SIGNATURE_INVALID 코드로 콜백을 전송한다", async () => {
    const { notifyPackageValidationFailed } = await import("./callbacks");
    const { sendLoreWebhook } = await import("./webhook-sender");
    await notifyPackageValidationFailed({
      packageId: "pkg-002",
      userId: "user-001",
      failureCode: "DID_SIGNATURE_INVALID",
      errors: ["DID signature mismatch"],
      retryable: false,
    });
    expect(sendLoreWebhook).toHaveBeenCalledWith(
      "mip_package_validation_failed",
      expect.objectContaining({
        failureCode: "DID_SIGNATURE_INVALID",
        retryable: false,
      })
    );
  });

  it("TTL_EXPIRED는 retryable: false로 전송한다", async () => {
    const { notifyPackageValidationFailed } = await import("./callbacks");
    const { sendLoreWebhook } = await import("./webhook-sender");
    await notifyPackageValidationFailed({
      packageId: "pkg-003",
      userId: "user-001",
      failureCode: "TTL_EXPIRED",
      errors: ["Package TTL has expired"],
      retryable: false,
    });
    expect(sendLoreWebhook).toHaveBeenCalledWith(
      "mip_package_validation_failed",
      expect.objectContaining({ failureCode: "TTL_EXPIRED" })
    );
  });
});

describe("notifyImplantResult", () => {
  beforeEach(() => vi.clearAllMocks());

  it("이식 완료 결과를 Lore에 전송하고 감사 체인을 기록한다", async () => {
    const { notifyImplantResult } = await import("./callbacks");
    const { sendLoreWebhook } = await import("./webhook-sender");
    const { appendAuditChain } = await import("../lib/audit");
    await notifyImplantResult({
      implantationId: "impl-001",
      packageId: "pkg-001",
      userId: "user-001",
      deviceId: "dev-001",
      result: "success",
      sandboxScore: 0.95,
      activePolicies: ["p_harm", "p_child"],
      completedAt: Date.now(),
    });
    expect(sendLoreWebhook).toHaveBeenCalledWith(
      "mip_implant_result",
      expect.objectContaining({ result: "success", sandboxScore: 0.95 })
    );
    expect(appendAuditChain).toHaveBeenCalled();
  });
});

describe("requestPackageRefresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("갱신 요청을 Lore REST API로 전송하고 requestId를 반환한다", async () => {
    const { requestPackageRefresh } = await import("./callbacks");
    const result = await requestPackageRefresh({
      packageId: "pkg-001",
      userId: "user-001",
      reason: "ttl_expiring",
      urgency: "high",
    });
    expect(result).not.toBeNull();
    expect(result?.requestId).toBeDefined();
    expect(result?.estimatedCompletionMs).toBe(30000);
  });

  it("Lore API 실패 시 null을 반환한다", async () => {
    const { callLoreApi } = await import("./webhook-sender");
    vi.mocked(callLoreApi).mockResolvedValueOnce({ ok: false, status: 503 });
    const { requestPackageRefresh } = await import("./callbacks");
    const result = await requestPackageRefresh({
      packageId: "pkg-002",
      userId: "user-001",
      reason: "safety_anomaly",
    });
    expect(result).toBeNull();
  });
});

describe("Lore 환경변수 검증", () => {
  it("LORE_MIP_SHARED_SECRET이 설정되어 있다", async () => {
    const { ENV } = await import("../_core/env");
    expect(ENV.loreMipSharedSecret).toBeTruthy();
  });

  it("MIP_LORE_SHARED_SECRET이 설정되어 있다", async () => {
    const { ENV } = await import("../_core/env");
    expect(ENV.mipLoreSharedSecret).toBeTruthy();
  });
});
