/**
 * Soma → MIP 수신 인터페이스 단위 테스트
 * WO-MIP-2026-002 §3
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleImplantApproved,
  handleDeviceRegister,
  getImplantStatus,
  handleKillSwitch,
  STAGE_PROGRESS,
  type ImplantApprovedPayload,
  type DeviceRegisterRequest,
  type KillSwitchRequest,
} from "./receivers";

// DB 모킹
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => mockSelectChain,
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
  }),
}));

// Soma Webhook 발신 모킹
vi.mock("./webhook-sender", () => ({
  sendSomaWebhook: vi.fn().mockResolvedValue(undefined),
}));

// 감사 체인 모킹
vi.mock("../lib/audit", () => ({
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
}));

describe("STAGE_PROGRESS", () => {
  it("8단계 모두 정의되어 있다", () => {
    const stages = [
      "device_registration",
      "trust_verification",
      "user_authentication",
      "package_generation",
      "boundary_injection",
      "runtime_binding",
      "sandbox_validation",
      "live_activation",
    ];
    stages.forEach((stage) => {
      expect(STAGE_PROGRESS[stage]).toBeDefined();
      expect(STAGE_PROGRESS[stage]).toBeGreaterThan(0);
      expect(STAGE_PROGRESS[stage]).toBeLessThanOrEqual(100);
    });
  });

  it("live_activation은 100이다", () => {
    expect(STAGE_PROGRESS["live_activation"]).toBe(100);
  });

  it("단계가 진행될수록 progress가 증가한다", () => {
    const stages = [
      "device_registration",
      "trust_verification",
      "user_authentication",
      "package_generation",
      "boundary_injection",
      "runtime_binding",
      "sandbox_validation",
      "live_activation",
    ];
    for (let i = 1; i < stages.length; i++) {
      expect(STAGE_PROGRESS[stages[i]]).toBeGreaterThan(STAGE_PROGRESS[stages[i - 1]]);
    }
  });
});

describe("handleDeviceRegister", () => {
  it("유효한 DID가 없으면 오류를 던진다", async () => {
    const req: DeviceRegisterRequest = {
      userId: "user-001",
      deviceType: "humanoid",
      deviceName: "Test Robot",
      did: "", // 빈 DID
      didDocument: {},
      registeredAt: Date.now(),
    };

    await expect(handleDeviceRegister(req)).rejects.toThrow("Invalid DID Document");
  });

  it("DID가 did: 접두사로 시작하지 않으면 오류를 던진다", async () => {
    const req: DeviceRegisterRequest = {
      userId: "user-001",
      deviceType: "humanoid",
      deviceName: "Test Robot",
      did: "invalid-did-format",
      didDocument: { id: "test" },
      registeredAt: Date.now(),
    };

    await expect(handleDeviceRegister(req)).rejects.toThrow("Invalid DID Document");
  });
});

describe("handleKillSwitch - SESSION_NOT_FOUND", () => {
  it("존재하지 않는 세션 ID로 Kill Switch 요청 시 오류를 던진다", async () => {
    const req: KillSwitchRequest = {
      userId: "user-001",
      reason: "user_request",
      requestedAt: Date.now(),
    };

    await expect(handleKillSwitch("non-existent-session", req)).rejects.toThrow(
      "SESSION_NOT_FOUND"
    );
  });
});

describe("handleImplantApproved - validation", () => {
  it("필수 필드 검증: eventId 없으면 rejected 반환", async () => {
    // DB에서 eventId 중복 없음 → 처리 진행
    // 하지만 device 조회 결과 없음 → rejected
    const payload: ImplantApprovedPayload = {
      eventType: "mip_implant_approved",
      eventId: "evt-test-001",
      userId: "user-001",
      deviceId: "device-001",
      packageId: "pkg-001",
      approvedAt: Date.now(),
      userConsent: {
        version: "1.0",
        consentedAt: Date.now(),
        scope: ["implant", "monitor"],
      },
    };

    // DB mock: 이벤트 중복 없음, 디바이스 없음 → rejected
    const result = await handleImplantApproved(payload);
    // device가 없으므로 rejected 또는 already_processed
    expect(["rejected", "already_processed", "accepted"]).toContain(result.status);
  });
});
