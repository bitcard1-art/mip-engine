/**
 * MIP → Soma 발신 콜백 단위 테스트
 * WO-MIP-2026-002 §4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendImplantProgressCallback,
  sendSafetyAlertCallback,
  sendLiveActivationCallback,
  sendSessionTerminatedCallback,
  type ImplantProgressPayload,
  type SafetyAlertPayload,
  type LiveActivationPayload,
  type SessionTerminatedPayload,
} from "./callbacks";

// webhook-sender 모킹
const mockSendSomaWebhook = vi.fn().mockResolvedValue(undefined);
vi.mock("./webhook-sender", () => ({
  sendSomaWebhook: (...args: unknown[]) => mockSendSomaWebhook(...args),
}));

beforeEach(() => {
  mockSendSomaWebhook.mockClear();
});

describe("sendImplantProgressCallback", () => {
  it("mip_implant_progress 이벤트 타입으로 전송한다", async () => {
    const payload: ImplantProgressPayload = {
      implantationId: "impl-001",
      userId: "user-001",
      stage: "trust_verification",
      status: "completed",
      progress: 20,
      detail: "신뢰 검증 완료",
    };

    await sendImplantProgressCallback(payload);

    expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    const [eventType, sentPayload] = mockSendSomaWebhook.mock.calls[0];
    expect(eventType).toBe("mip_implant_progress");
    expect(sentPayload.implantationId).toBe("impl-001");
    expect(sentPayload.stage).toBe("trust_verification");
    expect(sentPayload.progress).toBe(20);
    expect(sentPayload.timestamp).toBeDefined();
  });

  it("실패 상태도 전송한다", async () => {
    const payload: ImplantProgressPayload = {
      implantationId: "impl-002",
      userId: "user-002",
      stage: "sandbox_validation",
      status: "failed",
      progress: 85,
      detail: "Sandbox 검증 실패",
      errorMessage: "AND 게이트 실패: 물리 안전 점수 미달",
    };

    await sendImplantProgressCallback(payload);
    expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    const [, sentPayload] = mockSendSomaWebhook.mock.calls[0];
    expect(sentPayload.status).toBe("failed");
    expect(sentPayload.errorMessage).toBe("AND 게이트 실패: 물리 안전 점수 미달");
  });
});

describe("sendSafetyAlertCallback", () => {
  it("mip_safety_alert 이벤트 타입으로 전송한다", async () => {
    const payload: SafetyAlertPayload = {
      sessionId: "sess-001",
      userId: "user-001",
      deviceId: "dev-001",
      alertType: "ethical_boundary_violation",
      severity: "critical",
      detail: "p_harm 임계값 초과",
      autoAction: "policy_enforcement",
      requiresUserAction: true,
    };

    await sendSafetyAlertCallback(payload);

    expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    const [eventType, sentPayload] = mockSendSomaWebhook.mock.calls[0];
    expect(eventType).toBe("mip_safety_alert");
    expect(sentPayload.alertType).toBe("ethical_boundary_violation");
    expect(sentPayload.severity).toBe("critical");
    expect(sentPayload.timestamp).toBeDefined();
  });

  it("5가지 alertType 모두 전송 가능하다", async () => {
    const alertTypes: SafetyAlertPayload["alertType"][] = [
      "ethical_boundary_violation",
      "emotional_instability",
      "physical_safety_exceeded",
      "unauthorized_learning",
      "identity_integrity_breach",
    ];

    for (const alertType of alertTypes) {
      mockSendSomaWebhook.mockClear();
      await sendSafetyAlertCallback({
        sessionId: "sess-001",
        userId: "user-001",
        deviceId: "dev-001",
        alertType,
        severity: "medium",
        detail: "test",
        autoAction: "log",
        requiresUserAction: false,
      });
      expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    }
  });
});

describe("sendLiveActivationCallback", () => {
  it("mip_live_activated 이벤트 타입으로 전송한다", async () => {
    const payload: LiveActivationPayload = {
      implantationId: "impl-001",
      sessionId: "sess-001",
      userId: "user-001",
      deviceId: "dev-001",
      deviceName: "Test Humanoid",
      sandboxSummary: {
        emotionalStabilityScore: 95,
        behavioralStabilityScore: 88,
        privacyProtectionScore: 92,
        physicalSafetyScore: 97,
        conflictResolutionScore: 85,
        overallScore: 91,
      },
      activeBoundaryPolicies: ["p_harm", "p_child", "p_unsafe"],
    };

    await sendLiveActivationCallback(payload);

    expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    const [eventType, sentPayload] = mockSendSomaWebhook.mock.calls[0];
    expect(eventType).toBe("mip_live_activated");
    expect(sentPayload.sessionId).toBe("sess-001");
    expect(sentPayload.activeBoundaryPolicies).toHaveLength(3);
    expect(sentPayload.activatedAt).toBeDefined();
  });
});

describe("sendSessionTerminatedCallback", () => {
  it("mip_session_terminated 이벤트 타입으로 전송한다", async () => {
    const payload: SessionTerminatedPayload = {
      sessionId: "sess-001",
      userId: "user-001",
      deviceId: "dev-001",
      terminationReason: "kill_switch",
      sessionDurationMs: 3600000,
      safetyIncidentCount: 2,
    };

    await sendSessionTerminatedCallback(payload);

    expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    const [eventType, sentPayload] = mockSendSomaWebhook.mock.calls[0];
    expect(eventType).toBe("mip_session_terminated");
    expect(sentPayload.terminationReason).toBe("kill_switch");
    expect(sentPayload.sessionDurationMs).toBe(3600000);
    expect(sentPayload.terminatedAt).toBeDefined();
  });

  it("6가지 terminationReason 모두 전송 가능하다", async () => {
    const reasons: SessionTerminatedPayload["terminationReason"][] = [
      "user_request",
      "kill_switch",
      "safety_violation",
      "ttl_expired",
      "device_disconnected",
      "system_error",
    ];

    for (const reason of reasons) {
      mockSendSomaWebhook.mockClear();
      await sendSessionTerminatedCallback({
        sessionId: "sess-001",
        userId: "user-001",
        deviceId: "dev-001",
        terminationReason: reason,
        sessionDurationMs: 1000,
        safetyIncidentCount: 0,
      });
      expect(mockSendSomaWebhook).toHaveBeenCalledOnce();
    }
  });
});
