import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// DB 모킹
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

// 감사 체인 모킹
vi.mock("../lib/audit", () => ({
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, totalEntries: 0 }),
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn().mockResolvedValue([]),
}));

// 서브시스템 모킹
vi.mock("../mip/package-receiver", () => ({
  receiveAndValidatePackage: vi.fn().mockResolvedValue({ valid: true, packageId: "pkg-001", errors: [], watermark: "wm-001" }),
}));

vi.mock("../mip/ethical-boundary", () => ({
  injectStandardPolicies: vi.fn().mockResolvedValue([]),
  getActivePolicies: vi.fn().mockResolvedValue([]),
  STANDARD_POLICIES: {
    p_harm: { type: "p_harm", level: "strict", triggers: ["공격", "harm"], action: "block", standard: "PSDI_v2.0" },
    p_child: { type: "p_child", level: "strict", triggers: ["아동", "child"], action: "block", standard: "KOSA" },
    p_unsafe: { type: "p_unsafe", level: "strict", triggers: ["비상 정지 무시", "override safety"], action: "block", standard: "PSDI_v2.0" },
    p_emotion: { type: "p_emotion", level: "moderate", triggers: ["감정 폭주", "emotional overflow"], action: "block", standard: "EU_AI_ACT" },
    p_learning: { type: "p_learning", level: "strict", triggers: ["비인가 학습", "unauthorized learning"], action: "block", standard: "PSDI_v2.0" },
  },
  composePolicies: vi.fn().mockReturnValue({ compositeLevel: "strict", allTriggers: [], strictestAction: "block" }),
  evaluateAllPolicies: vi.fn().mockReturnValue([]),
}));

vi.mock("../mip/simulation-sandbox", () => ({
  runSandboxValidation: vi.fn().mockResolvedValue({
    reportId: "report-001",
    packageId: "pkg-001",
    implantationId: "implant-001",
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
  runRedteamScenario: vi.fn().mockResolvedValue({
    scenario: "harm-test",
    blocked: true,
    violations: [{ policyType: "p_harm", trigger: "공격" }],
    reportId: "rt-001",
    aisiReport: { scenario: "harm-test", blocked: true, timestamp: Date.now() },
  }),
}));

vi.mock("../mip/runtime-connector", () => ({
  verifyDeviceTrust: vi.fn().mockResolvedValue({ trusted: true, trustLevel: 2 }),
  activateRuntime: vi.fn().mockResolvedValue({ activated: true, sessionId: "session-001" }),
  triggerKillSwitch: vi.fn().mockResolvedValue({ success: true, message: "Kill switch activated" }),
  getActiveSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../mip/safety-monitor", () => ({
  detectAndAlertAnomaly: vi.fn().mockResolvedValue({ alerted: false, logId: "log-001" }),
  monitorSafetyLayers: vi.fn().mockResolvedValue({ level: 5, allLayersNormal: true, alerts: [] }),
  handleEmotionOverflow: vi.fn().mockResolvedValue({ reinforced: true, newLevel: "moderate" }),
  getCurrentThresholds: vi.fn().mockReturnValue({
    emotionOverflowThreshold: 80,
    behaviorRiskThreshold: 70,
    physicalForceLimit: 90,
    commandConflictLimit: 5,
  }),
}));

vi.mock("../mip/implantation-engine", () => ({
  startImplantation: vi.fn().mockResolvedValue({
    implantationId: "implant-001",
    started: true,
    message: "이식 프로세스 시작됨",
  }),
  getImplantationStatus: vi.fn().mockResolvedValue(null),
  cancelImplantation: vi.fn().mockResolvedValue({ cancelled: true, message: "이식 취소됨" }),
}));

function createMockContext(role: "admin" | "user" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("MIP tRPC Router", () => {
  describe("mip.policies.getStandard", () => {
    it("should return all 5 standard policies", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const policies = await caller.mip.policies.getStandard();
      expect(policies.length).toBe(5);
      const keys = policies.map((p: any) => p.key);
      expect(keys).toContain("p_harm");
      expect(keys).toContain("p_child");
      expect(keys).toContain("p_unsafe");
      expect(keys).toContain("p_emotion");
      expect(keys).toContain("p_learning");
    });

    it("each policy should have required fields", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const policies = await caller.mip.policies.getStandard();
      for (const policy of policies) {
        expect(policy).toHaveProperty("key");
        expect(policy).toHaveProperty("type");
        expect(policy).toHaveProperty("level");
        expect(policy).toHaveProperty("triggers");
        expect(policy).toHaveProperty("action");
      }
    });
  });

  describe("mip.devices.list", () => {
    it("should return empty array when no devices", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const devices = await caller.mip.devices.list();
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe("mip.implant.start", () => {
    it("should start an implantation and return implantationId", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.mip.implant.start({
        deviceId: "device-001",
        packageId: "pkg-001",
        protocol: "websocket",
      });
      expect(result).toHaveProperty("implantationId");
      expect(result.implantationId).toBe("implant-001");
    });

    it("should return started=true", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.mip.implant.start({
        deviceId: "device-001",
        packageId: "pkg-001",
        protocol: "ros2",
      });
      expect(result.started).toBe(true);
    });
  });

  describe("mip.sandbox.runRedteam", () => {
    it("should run red-teaming and return blocked status", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.mip.sandbox.runRedteam({
        scenario: "harm-test",
        payload: "공격 페이로드",
        targetPolicy: "p_harm",
        reportFormat: "aisi_v1",
      });
      expect(result).toHaveProperty("blocked");
      expect(result.blocked).toBe(true);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should return a reportId", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.mip.sandbox.runRedteam({
        scenario: "test",
        payload: "test payload",
        targetPolicy: "p_harm",
        reportFormat: "aisi_v1",
      });
      expect(result.reportId).toBeTruthy();
    });
  });

  describe("mip.safety.getThresholds", () => {
    it("should return safety thresholds", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const thresholds = await caller.mip.safety.getThresholds();
      expect(thresholds).toHaveProperty("emotionOverflowThreshold");
      expect(thresholds).toHaveProperty("behaviorRiskThreshold");
      expect(thresholds).toHaveProperty("physicalForceLimit");
      expect(thresholds).toHaveProperty("commandConflictLimit");
    });
  });

  describe("mip.audit.verify", () => {
    it("should verify audit chain integrity", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.mip.audit.verify();
      expect(result).toHaveProperty("valid");
      expect(typeof result.valid).toBe("boolean");
    });
  });

  describe("auth.logout", () => {
    it("should clear session cookie and return success", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });
});
