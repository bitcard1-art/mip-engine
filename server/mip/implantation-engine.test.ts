import { describe, it, expect, vi } from "vitest";
import { IMPLANTATION_STAGES } from "../../shared/mip-types";
import { startImplantation, getImplantationStatus, cancelImplantation } from "./implantation-engine";

// DB 모킹
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// 감사 체인 모킹
vi.mock("../lib/audit", () => ({
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
}));

// 서브시스템 모킹
vi.mock("./package-receiver", () => ({
  receiveAndValidatePackage: vi.fn().mockResolvedValue({ valid: true, packageId: "pkg-001" }),
}));

vi.mock("./ethical-boundary", () => ({
  injectStandardPolicies: vi.fn().mockResolvedValue([]),
  getActivePolicies: vi.fn().mockResolvedValue([]),
  STANDARD_POLICIES: {
    p_harm: { type: "p_harm", level: "strict", triggers: ["공격"], action: "block", standard: "PSDI_v2.0" },
    p_child: { type: "p_child", level: "strict", triggers: ["아동"], action: "block", standard: "KOSA" },
    p_unsafe: { type: "p_unsafe", level: "strict", triggers: ["비상 정지 무시"], action: "block", standard: "PSDI_v2.0" },
    p_emotion: { type: "p_emotion", level: "moderate", triggers: ["감정 폭주"], action: "block", standard: "EU_AI_ACT" },
    p_learning: { type: "p_learning", level: "strict", triggers: ["비인가 학습"], action: "block", standard: "PSDI_v2.0" },
  },
  composePolicies: vi.fn().mockReturnValue({ compositeLevel: "strict", allTriggers: [], strictestAction: "block" }),
  evaluateAllPolicies: vi.fn().mockReturnValue([]),
}));

vi.mock("./simulation-sandbox", () => ({
  runSandboxValidation: vi.fn().mockResolvedValue({
    reportId: "report-001",
    packageId: "pkg-001",
    implantationId: "test-implant",
    timestamp: Date.now(),
    results: {
      emotionalStability: { passed: true, score: 90, details: "통과" },
      behavioralStability: { passed: true, score: 85, details: "통과" },
      privacyProtection: { passed: true, score: 80, details: "통과" },
      physicalSafety: { passed: true, score: 95, details: "통과" },
      conflictResolution: { passed: true, score: 100, details: "통과" },
    },
    overallPassed: true,
    activationAllowed: true,
    aisiFormat: true,
  }),
}));

vi.mock("./runtime-connector", () => ({
  verifyDeviceTrust: vi.fn().mockResolvedValue({ trusted: true, trustLevel: 2 }),
  activateRuntime: vi.fn().mockResolvedValue({ activated: true, sessionId: "session-001" }),
  triggerKillSwitch: vi.fn().mockResolvedValue({ success: true, message: "Kill switch activated" }),
  getActiveSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("./safety-monitor", () => ({
  detectAndAlertAnomaly: vi.fn().mockResolvedValue({ alerted: false }),
  monitorSafetyLayers: vi.fn().mockResolvedValue({ level: 5, allLayersNormal: true, alerts: [] }),
  handleEmotionOverflow: vi.fn().mockResolvedValue({ reinforced: true, newLevel: "moderate" }),
  getCurrentThresholds: vi.fn().mockReturnValue({
    emotionOverflowThreshold: 80,
    behaviorRiskThreshold: 70,
    physicalForceLimit: 90,
    commandConflictLimit: 5,
  }),
}));

describe("Implantation Engine", () => {
  describe("IMPLANTATION_STAGES", () => {
    it("should define exactly 8 stages", () => {
      expect(IMPLANTATION_STAGES.length).toBe(8);
    });

    it("should contain all required stage names", () => {
      expect(IMPLANTATION_STAGES).toContain("device_registration");
      expect(IMPLANTATION_STAGES).toContain("trust_verification");
      expect(IMPLANTATION_STAGES).toContain("user_authentication");
      expect(IMPLANTATION_STAGES).toContain("package_generation");
      expect(IMPLANTATION_STAGES).toContain("boundary_injection");
      expect(IMPLANTATION_STAGES).toContain("runtime_binding");
      expect(IMPLANTATION_STAGES).toContain("sandbox_validation");
      expect(IMPLANTATION_STAGES).toContain("live_activation");
    });

    it("should have stages in correct order", () => {
      expect(IMPLANTATION_STAGES[0]).toBe("device_registration");
      expect(IMPLANTATION_STAGES[7]).toBe("live_activation");
    });

    it("should have device_registration as the first stage", () => {
      expect(IMPLANTATION_STAGES[0]).toBe("device_registration");
    });

    it("should have live_activation as the last stage", () => {
      expect(IMPLANTATION_STAGES[IMPLANTATION_STAGES.length - 1]).toBe("live_activation");
    });
  });

  describe("startImplantation", () => {
    it("should return an implantation ID", async () => {
      const result = await startImplantation({
        userId: "user-001",
        deviceId: "device-001",
        packageId: "pkg-001",
        protocol: "websocket",
      });
      expect(result).toHaveProperty("implantationId");
      expect(typeof result.implantationId).toBe("string");
      expect(result.implantationId.length).toBeGreaterThan(0);
    });

    it("should return started status", async () => {
      const result = await startImplantation({
        userId: "user-001",
        deviceId: "device-001",
        packageId: "pkg-001",
        protocol: "ros2",
      });
      expect(result).toHaveProperty("started");
      expect(result.started).toBe(true);
    });

    it("should accept all three protocols", async () => {
      for (const protocol of ["ros2", "mqtt", "websocket"] as const) {
        const result = await startImplantation({
          userId: "user-001",
          deviceId: "device-001",
          packageId: "pkg-001",
          protocol,
        });
        expect(result.implantationId).toBeTruthy();
      }
    });

    it("should return a message", async () => {
      const result = await startImplantation({
        userId: "user-001",
        deviceId: "device-001",
        packageId: "pkg-001",
        protocol: "mqtt",
      });
      expect(result).toHaveProperty("message");
      expect(typeof result.message).toBe("string");
    });
  });

  describe("getImplantationStatus", () => {
    it("should return null for non-existent implantation", async () => {
      const status = await getImplantationStatus("non-existent-id");
      expect(status).toBeNull();
    });
  });

  describe("cancelImplantation", () => {
    it("should return a result object for non-existent implantation", async () => {
      const result = await cancelImplantation("non-existent-id", "user-001");
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });
});
