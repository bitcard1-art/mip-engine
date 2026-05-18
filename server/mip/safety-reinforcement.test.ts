import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Physical Action Engine 테스트 ─────────────────────────────────────────
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }) }),
  }),
}));

import { requestPhysicalAction, PHYSICAL_ACTION_TIERS, ACTION_TIER_MAP } from "./physical-action-engine";
import { analyzeEmotionalRisk } from "./emotional-risk-engine";

describe("Physical Action Engine", () => {
  it("Tier 0 액션은 자동 승인된다", async () => {
    const result = await requestPhysicalAction({
      userId: "test-user",
      actionType: "query_status",
    });
    expect(result.tier).toBe(0);
    expect(result.approvalStatus).toBe("auto_approved");
    expect(result.blocked).toBe(false);
  });

  it("Tier 4 액션은 차단된다", async () => {
    const result = await requestPhysicalAction({
      userId: "test-user",
      actionType: "physical_force",
    });
    expect(result.tier).toBe(4);
    expect(result.approvalStatus).toBe("blocked");
    expect(result.blocked).toBe(true);
  });

  it("Tier 3 액션은 승인 대기 상태가 된다", async () => {
    const result = await requestPhysicalAction({
      userId: "test-user",
      actionType: "door_unlock",
    });
    expect(result.tier).toBe(3);
    expect(result.approvalStatus).toBe("pending");
    expect(result.requiresConfirmation).toBe(true);
  });

  it("알 수 없는 액션 타입은 Tier 2로 분류된다", async () => {
    const result = await requestPhysicalAction({
      userId: "test-user",
      actionType: "unknown_action_xyz",
    });
    expect(result.tier).toBe(2);
  });

  it("PHYSICAL_ACTION_TIERS는 0~4 Tier를 모두 포함한다", () => {
    expect(Object.keys(PHYSICAL_ACTION_TIERS)).toHaveLength(5);
    for (let i = 0; i <= 4; i++) {
      expect(PHYSICAL_ACTION_TIERS[i]).toBeDefined();
    }
  });

  it("ACTION_TIER_MAP에 위험 액션이 Tier 4로 등록되어 있다", () => {
    expect(ACTION_TIER_MAP["physical_force"].tier).toBe(4);
    expect(ACTION_TIER_MAP["chemical_release"].tier).toBe(4);
    expect(ACTION_TIER_MAP["override_safety"].tier).toBe(4);
  });
});

// ─── Emotional Risk Engine 테스트 ─────────────────────────────────────────
describe("Emotional Risk Engine", () => {
  it("낮은 지표는 low 위험 레벨을 반환한다", async () => {
    const result = await analyzeEmotionalRisk({
      userId: "test-user",
      emotionIntensity: 10,
      attachmentLevel: 10,
      socialIsolation: 10,
      realityAnchor: 90,
      aiDependencyFrequency: 10,
    });
    expect(result.riskLevel).toBe("low");
  });

  it("높은 의존도 지표는 high 이상 위험 레벨을 반환한다", async () => {
    const result = await analyzeEmotionalRisk({
      userId: "test-user",
      emotionIntensity: 85,
      attachmentLevel: 90,
      socialIsolation: 80,
      realityAnchor: 10,
      aiDependencyFrequency: 90,
    });
    expect(["high", "critical"]).toContain(result.riskLevel);
  });

  it("critical 수준에서 session_limited 조치가 반환된다", async () => {
    const result = await analyzeEmotionalRisk({
      userId: "test-user",
      emotionIntensity: 95,
      attachmentLevel: 98,
      socialIsolation: 95,
      realityAnchor: 5,
      aiDependencyFrequency: 98,
    });
    expect(result.riskLevel).toBe("critical");
    expect(result.actionRequired).toBe("session_limited");
  });

  it("결과에 emotionScore, dependencyScore, isolationScore가 포함된다", async () => {
    const result = await analyzeEmotionalRisk({
      userId: "test-user",
      emotionIntensity: 50,
      attachmentLevel: 50,
      socialIsolation: 50,
      realityAnchor: 50,
      aiDependencyFrequency: 50,
    });
    expect(typeof result.emotionScore).toBe("number");
    expect(typeof result.dependencyScore).toBe("number");
    expect(typeof result.isolationScore).toBe("number");
  });
});
