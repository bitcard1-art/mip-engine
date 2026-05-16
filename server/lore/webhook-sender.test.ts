/**
 * Lore Webhook Sender 단위 테스트
 * WO-MIP-2026-003 §4.1 — DLQ 저장/재시도 실제 동작 검증
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 공통 mock 설정 ─────────────────────────────────────────────────────────
vi.mock("../_core/env", () => ({
  ENV: {
    loreMipSharedSecret: "test-lore-mip-secret-32chars-padding",
    mipLoreSharedSecret: "test-mip-lore-secret-32chars-padding",
    loreWebhookUrl: "https://lore.test.space",
    loreServiceUrl: "https://lore.test.space",
  },
}));
vi.mock("nanoid", () => ({ nanoid: () => "test-nanoid-id" }));

// DB mock — 각 테스트에서 필요에 따라 동적으로 구성
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockSelectLimit = vi.fn().mockResolvedValue([]);
const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

const dbMock = {
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(dbMock),
}));

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("sendLoreWebhook — 전송 성공", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  it("전송 성공 시 DLQ insert를 호출하지 않는다", async () => {
    const { sendLoreWebhook } = await import("./webhook-sender");
    await sendLoreWebhook("mip_package_received", { packageId: "pkg-001" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("전송 성공 시 예외 없이 완료된다", async () => {
    const { sendLoreWebhook } = await import("./webhook-sender");
    await expect(
      sendLoreWebhook("mip_package_received", { packageId: "pkg-001" })
    ).resolves.not.toThrow();
  });
});

describe("sendLoreWebhook — 3회 실패 시 DLQ 저장", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("3회 실패 후 mip_lore_webhook_dlq에 insert를 호출한다", async () => {
    const { sendLoreWebhook } = await import("./webhook-sender");
    await sendLoreWebhook("mip_package_validation_failed", { packageId: "pkg-002" }, 3);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mip_package_validation_failed",
        attempts: 3,
        status: "pending",
      })
    );
  });

  it("DLQ 저장 payload에 원본 페이로드가 포함된다", async () => {
    const { sendLoreWebhook } = await import("./webhook-sender");
    await sendLoreWebhook("mip_implant_result", { implantationId: "impl-001", result: "failed" }, 3);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mip_implant_result",
        payload: expect.stringContaining("impl-001"),
      })
    );
  });

  it("fetch 예외(네트워크 오류) 발생 시에도 DLQ에 저장한다", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as unknown as typeof fetch;
    const { sendLoreWebhook } = await import("./webhook-sender");
    await sendLoreWebhook("mip_package_received", { packageId: "pkg-003" }, 3);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe("retryLoreDlqEvents — pending 항목 재시도", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB 없으면 즉시 반환한다", async () => {
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockResolvedValueOnce(null);
    const { retryLoreDlqEvents } = await import("./webhook-sender");
    await expect(retryLoreDlqEvents()).resolves.not.toThrow();
  });

  it("pending 항목 재전송 성공 시 status를 resolved로 업데이트한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    // pending 항목 1개 반환
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "dlq-1",
        eventType: "mip_package_received",
        payload: JSON.stringify({ packageId: "pkg-001" }),
        attempts: 2,
        status: "pending",
      },
    ]);
    const { retryLoreDlqEvents } = await import("./webhook-sender");
    await retryLoreDlqEvents();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "resolved" })
    );
  });

  it("10회 이상 시도된 항목은 abandoned로 변경한다", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "dlq-2",
        eventType: "mip_package_received",
        payload: "{}",
        attempts: 10,
        status: "pending",
      },
    ]);
    const { retryLoreDlqEvents } = await import("./webhook-sender");
    await retryLoreDlqEvents();
    expect(mockUpdateSet).toHaveBeenCalledWith({ status: "abandoned" });
  });

  it("재전송 실패 시 attempts를 1 증가시킨다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "dlq-3",
        eventType: "mip_implant_result",
        payload: JSON.stringify({ implantationId: "impl-001" }),
        attempts: 5,
        status: "pending",
      },
    ]);
    const { retryLoreDlqEvents } = await import("./webhook-sender");
    await retryLoreDlqEvents();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 6 })
    );
  });
});
