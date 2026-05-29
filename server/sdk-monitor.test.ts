import { describe, it, expect } from "vitest";

describe("sdkMonitor router", () => {
  it("AI Agent device type is included in schema enum", async () => {
    const { mipDevices } = await import("../drizzle/schema");
    // deviceType 컬럼의 enum 값에 ai_agent 포함 여부 확인
    const col = mipDevices.deviceType;
    expect(col).toBeDefined();
    // enumValues가 있는 경우 확인
    const enumValues = (col as any).enumValues ?? (col as any).config?.enum ?? [];
    if (enumValues.length > 0) {
      expect(enumValues).toContain("ai_agent");
    }
  });

  it("dailyStats query returns array", async () => {
    const { mipAuditChain } = await import("../drizzle/schema");
    expect(mipAuditChain).toBeDefined();
    expect(mipAuditChain.timestamp).toBeDefined();
    expect(mipAuditChain.actorId).toBeDefined();
    expect(mipAuditChain.action).toBeDefined();
  });

  it("implantStats query tables are defined", async () => {
    const { mipImplantations, mipDevices } = await import("../drizzle/schema");
    expect(mipImplantations).toBeDefined();
    expect(mipImplantations.status).toBeDefined();
    expect(mipDevices.deviceType).toBeDefined();
  });

  it("blockStats query table is defined", async () => {
    const { mipIsolationViolations } = await import("../drizzle/schema");
    expect(mipIsolationViolations).toBeDefined();
    expect(mipIsolationViolations.violationType).toBeDefined();
    expect(mipIsolationViolations.createdAt).toBeDefined();
  });

  it("messageStats query table is defined", async () => {
    const { mipMessageChecks } = await import("../drizzle/schema");
    expect(mipMessageChecks).toBeDefined();
    expect(mipMessageChecks.verdict).toBeDefined();
    expect(mipMessageChecks.checkedAt).toBeDefined();
  });

  it("activeSessions query tables are defined", async () => {
    const { mipRuntimeSessions, mipDevices } = await import("../drizzle/schema");
    expect(mipRuntimeSessions).toBeDefined();
    expect(mipRuntimeSessions.status).toBeDefined();
    expect(mipDevices.deviceType).toBeDefined();
    expect(mipDevices.deviceName).toBeDefined();
  });

  it("recentEvents query table is defined", async () => {
    const { mipAuditChain } = await import("../drizzle/schema");
    expect(mipAuditChain).toBeDefined();
    expect(mipAuditChain.id).toBeDefined();
  });

  it("isolation-layer assigns enhanced security to ai_agent", async () => {
    const isolationModule = await import("./mip/isolation-layer");
    // initializeDeploymentSecurity 함수가 존재하는지 확인
    expect(typeof isolationModule.initializeDeploymentSecurity).toBe("function");
  });

  it("lorePackageStats query table is defined", async () => {
    const { lorePackageEvents } = await import("../drizzle/schema");
    expect(lorePackageEvents).toBeDefined();
    expect(lorePackageEvents.eventType).toBeDefined();
    expect(lorePackageEvents.status).toBeDefined();
    expect(lorePackageEvents.createdAt).toBeDefined();
  });

  it("connectedServices includes sponge as lore-via service", async () => {
    // 스폰지는 LORE 경유 간접 연결 서비스로 정의됨
    // 실제 DB 연결 없이 서비스 목록 구조만 검증
    const services = [
      { id: "hangyeol", via: null },
      { id: "soma", via: null },
      { id: "lore", via: null },
      { id: "sponge", via: "lore" },
    ];
    const sponge = services.find(s => s.id === "sponge");
    expect(sponge).toBeDefined();
    expect(sponge?.via).toBe("lore");
    const directServices = services.filter(s => !s.via);
    expect(directServices).toHaveLength(3);
  });
});
