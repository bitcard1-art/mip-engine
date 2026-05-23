import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// DB 모킹 — insert/select 체이닝 지원
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => mockSelect(...args),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/hmac", () => ({
  generatePackageWatermark: vi.fn().mockReturnValue("mock-watermark-123"),
  sha256Hash: vi.fn().mockReturnValue("mock-sha256-hash"),
  verifyHmacHeader: vi.fn().mockReturnValue(true),
}));

vi.mock("../lib/audit", () => ({
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, totalEntries: 0 }),
  appendAuditChain: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../mip/package-receiver", () => ({
  receiveAndValidatePackage: vi.fn().mockResolvedValue({ valid: true, packageId: "pkg-001", errors: [], watermark: "wm-001" }),
}));

vi.mock("../mip/ethical-boundary", () => ({
  injectStandardPolicies: vi.fn().mockResolvedValue([]),
  getActivePolicies: vi.fn().mockResolvedValue([]),
  STANDARD_POLICIES: {
    p_harm: { type: "p_harm", level: "strict", triggers: [], action: "block", standard: "PSDI_v2.0" },
    p_child: { type: "p_child", level: "strict", triggers: [], action: "block", standard: "KOSA" },
    p_unsafe: { type: "p_unsafe", level: "strict", triggers: [], action: "block", standard: "PSDI_v2.0" },
    p_emotion: { type: "p_emotion", level: "moderate", triggers: [], action: "block", standard: "EU_AI_ACT" },
    p_learning: { type: "p_learning", level: "strict", triggers: [], action: "block", standard: "PSDI_v2.0" },
  },
  composePolicies: vi.fn().mockReturnValue({ compositeLevel: "strict", allTriggers: [], strictestAction: "block" }),
  evaluateAllPolicies: vi.fn().mockReturnValue([]),
}));

vi.mock("../mip/simulation-sandbox", () => ({
  runSandboxValidation: vi.fn().mockResolvedValue({ reportId: "r1", overallPassed: true }),
  runRedteamScenario: vi.fn().mockResolvedValue({ blocked: true }),
}));

vi.mock("../mip/runtime-connector", () => ({
  verifyDeviceTrust: vi.fn().mockResolvedValue({ trusted: true, trustLevel: 2 }),
  activateRuntime: vi.fn().mockResolvedValue({ activated: true, sessionId: "s1" }),
  triggerKillSwitch: vi.fn().mockResolvedValue({ success: true }),
  getActiveSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../mip/safety-monitor", () => ({
  detectAndAlertAnomaly: vi.fn().mockResolvedValue({ alerted: false }),
  monitorSafetyLayers: vi.fn().mockResolvedValue({ level: 5, allLayersNormal: true, alerts: [] }),
  handleEmotionOverflow: vi.fn().mockResolvedValue({ reinforced: true }),
  getCurrentThresholds: vi.fn().mockReturnValue({ emotionOverflowThreshold: 80, behaviorRiskThreshold: 70, physicalForceLimit: 90, commandConflictLimit: 5 }),
}));

vi.mock("../mip/implantation-engine", () => ({
  startImplantation: vi.fn().mockResolvedValue({ implantationId: "i1", started: true }),
  getImplantationStatus: vi.fn().mockResolvedValue(null),
  cancelImplantation: vi.fn().mockResolvedValue({ cancelled: true }),
}));

vi.mock("../mip/physical-action-engine", () => ({
  requestPhysicalAction: vi.fn().mockResolvedValue({ actionId: "a1" }),
  approvePhysicalAction: vi.fn().mockResolvedValue({ approved: true }),
  rejectPhysicalAction: vi.fn().mockResolvedValue({ rejected: true }),
  ACTION_TIER_MAP: {},
  PHYSICAL_ACTION_TIERS: [],
}));

vi.mock("../mip/emotional-risk-engine", () => ({
  analyzeEmotionalRisk: vi.fn().mockResolvedValue({ riskLevel: "low" }),
  getEmotionalRiskHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("../mip/dna-rollback-engine", () => ({
  createDnaSnapshot: vi.fn().mockResolvedValue({ versionId: "v1" }),
  getDnaVersionHistory: vi.fn().mockResolvedValue([]),
  rollbackDna: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../mip/isolation-layer", () => ({
  checkIsolationLayer: vi.fn().mockResolvedValue({ intact: true }),
  getCoreIdentity: vi.fn().mockResolvedValue(null),
  getDeploymentSecurity: vi.fn().mockResolvedValue(null),
  getIsolationViolations: vi.fn().mockResolvedValue([]),
}));

vi.mock("../mip/emotional-bridge", () => ({
  processEmotionalBridge: vi.fn().mockResolvedValue({ processed: true }),
  getEmotionalBridgeEvents: vi.fn().mockResolvedValue([]),
  calculateHomeostasisScore: vi.fn().mockResolvedValue(85),
}));

vi.mock("../mip/ledger-anchoring", () => ({
  anchorToLedger: vi.fn().mockResolvedValue({ anchorId: "anc1" }),
  verifyAnchor: vi.fn().mockResolvedValue({ valid: true }),
  getLedgerAnchors: vi.fn().mockResolvedValue([]),
  getLedgerAnchorStats: vi.fn().mockResolvedValue({ total: 0, verified: 0 }),
  retryLedgerDlq: vi.fn().mockResolvedValue({ retried: 0 }),
}));

vi.mock("../lore/webhook-sender", () => ({
  callLoreApi: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
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

describe("mip.packages.generateMock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a mock package with selected personas", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mip.packages.generateMock({
      personas: ["emotional", "cognitive"],
      purpose: "software_runtime",
    });

    expect(result.packageId).toMatch(/^pkg-mock-/);
    expect(result.message).toContain("2개 자아");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("should generate a mock package with all 8 personas", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mip.packages.generateMock({
      personas: ["emotional", "cognitive", "social", "creative", "moral", "habitual", "linguistic", "relational"],
      purpose: "humanoid_implant",
    });

    expect(result.packageId).toMatch(/^pkg-mock-/);
    expect(result.message).toContain("8개 자아");
  });

  it("should reject empty personas array", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.mip.packages.generateMock({
        personas: [],
        purpose: "software_runtime",
      })
    ).rejects.toThrow();
  });

  it("should default purpose to software_runtime", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mip.packages.generateMock({
      personas: ["emotional"],
    });

    expect(result.packageId).toMatch(/^pkg-mock-/);
    expect(result.message).toContain("1개 자아");
  });

  it("should call appendAuditChain after generating", async () => {
    const { appendAuditChain } = await import("../lib/audit");
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await caller.mip.packages.generateMock({
      personas: ["emotional", "cognitive", "social"],
      purpose: "iot_device",
    });

    expect(appendAuditChain).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "package",
        action: "mock_package_generated",
        data: expect.objectContaining({
          personas: ["emotional", "cognitive", "social"],
          purpose: "iot_device",
        }),
      })
    );
  });
});
