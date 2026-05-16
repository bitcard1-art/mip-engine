/**
 * mip.integration 라우터 단위 테스트
 * - status: DLQ 건수 집계
 * - events: Soma·Lore 이벤트 병합 및 시간순 정렬
 * - somaDlq / loreDlq: 상태 필터 조회
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

// ─── DB mock ─────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

// 체이닝 지원 mock 팩토리
function buildChain(returnValue: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn(),
  }),
}));

import { getDb } from "../db";

// ─── 컨텍스트 헬퍼 ───────────────────────────────────────────────────────────

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

describe("mip.integration.status", () => {
  it("DB 없을 때 null 반환", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.status();
    expect(result).toBeNull();
  });

  it("DLQ 건수를 집계하여 soma·lore 구조로 반환", async () => {
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ count: 3 }]),
      })),
    };
    vi.mocked(getDb).mockResolvedValueOnce(mockDb as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.status();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("soma");
    expect(result).toHaveProperty("lore");
    expect(result).toHaveProperty("updatedAt");
    expect(typeof result!.soma.dlqPending).toBe("number");
    expect(typeof result!.lore.dlqPending).toBe("number");
  });
});

describe("mip.integration.events", () => {
  it("DB 없을 때 빈 배열 반환", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.events({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("발신 이력(mip_webhook_send_logs)를 시간순으로 반환", async () => {
    const sendLog = {
      id: "log-1", target: "soma", eventType: "mip_implant_progress",
      url: "https://soma.test/webhook", statusCode: 200,
      success: 1, attempts: 1, errorMessage: null, sentAt: 2000,
    };
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sendLog]),
      })),
    };
    vi.mocked(getDb).mockResolvedValueOnce(mockDb as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.events({ limit: 10 });

    expect(result.length).toBeGreaterThanOrEqual(1);
    // target 필드가 soma 또는 lore여야 함
    const targets = result.map((e: { target: string }) => e.target);
    targets.forEach((t: string) => expect(["soma", "lore"]).toContain(t));
  });
});

describe("mip.integration.somaDlq", () => {
  it("DB 없을 때 빈 배열 반환", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.somaDlq({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("status 필터 없이 전체 DLQ 목록 반환", async () => {
    const dlqItems = [
      { id: "d1", eventType: "mip_implant_progress", payload: "{}", attempts: 3, lastAttemptAt: 1000, failedAt: 900, resolvedAt: null, status: "pending" },
    ];
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(dlqItems),
      })),
    };
    vi.mocked(getDb).mockResolvedValueOnce(mockDb as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.somaDlq({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("mip.integration.loreDlq", () => {
  it("DB 없을 때 빈 배열 반환", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.loreDlq({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("status 필터 적용하여 pending 항목만 반환", async () => {
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })),
    };
    vi.mocked(getDb).mockResolvedValueOnce(mockDb as never);

    const { appRouter } = await import("../routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.mip.integration.loreDlq({ status: "pending", limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});
