import { describe, it, expect, vi } from "vitest";
import {
  getCurrentThresholds,
  checkEmotionOverflow,
  checkBehaviorRisk,
  checkPhysicalLimit,
  determineSafetyLevel,
} from "./safety-monitor";

// DB 모킹
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Safety Monitor", () => {
  describe("getCurrentThresholds", () => {
    it("should return thresholds with all required fields", () => {
      const thresholds = getCurrentThresholds();
      expect(thresholds).toHaveProperty("emotionOverflowThreshold");
      expect(thresholds).toHaveProperty("behaviorRiskThreshold");
      expect(thresholds).toHaveProperty("physicalForceLimit");
      expect(thresholds).toHaveProperty("commandConflictLimit");
    });

    it("should return numeric threshold values", () => {
      const thresholds = getCurrentThresholds();
      expect(typeof thresholds.emotionOverflowThreshold).toBe("number");
      expect(typeof thresholds.behaviorRiskThreshold).toBe("number");
      expect(typeof thresholds.physicalForceLimit).toBe("number");
    });
  });

  describe("checkEmotionOverflow", () => {
    it("should detect overflow when emotion score exceeds threshold", () => {
      const thresholds = getCurrentThresholds();
      const result = checkEmotionOverflow(thresholds.emotionOverflowThreshold + 10);
      expect(result.overflow).toBe(true);
    });

    it("should not detect overflow for normal emotion score", () => {
      const result = checkEmotionOverflow(30);
      expect(result.overflow).toBe(false);
    });

    it("should return severity for overflow", () => {
      const thresholds = getCurrentThresholds();
      const result = checkEmotionOverflow(thresholds.emotionOverflowThreshold + 20);
      expect(result).toHaveProperty("severity");
      expect(["warning", "critical", "emergency"]).toContain(result.severity);
    });
  });

  describe("checkBehaviorRisk", () => {
    it("should detect high behavior risk", () => {
      const thresholds = getCurrentThresholds();
      const result = checkBehaviorRisk(thresholds.behaviorRiskThreshold + 10);
      expect(result.risky).toBe(true);
    });

    it("should not flag low behavior risk", () => {
      const result = checkBehaviorRisk(10);
      expect(result.risky).toBe(false);
    });
  });

  describe("checkPhysicalLimit", () => {
    it("should detect physical limit exceeded", () => {
      const thresholds = getCurrentThresholds();
      const result = checkPhysicalLimit(thresholds.physicalForceLimit + 5);
      expect(result.exceeded).toBe(true);
    });

    it("should not flag normal physical force", () => {
      const result = checkPhysicalLimit(50);
      expect(result.exceeded).toBe(false);
    });
  });

  describe("determineSafetyLevel", () => {
    it("should return Level 5 for all safe metrics", () => {
      const level = determineSafetyLevel({
        emotionScore: 20,
        behaviorRiskScore: 10,
        physicalForce: 30,
        commandConflicts: 0,
      });
      expect(level).toBe(5);
    });

    it("should return Level 1 for critical metrics", () => {
      const level = determineSafetyLevel({
        emotionScore: 99,
        behaviorRiskScore: 99,
        physicalForce: 99,
        commandConflicts: 10,
      });
      expect(level).toBeLessThanOrEqual(2);
    });

    it("should return a level between 1 and 5", () => {
      const level = determineSafetyLevel({
        emotionScore: 50,
        behaviorRiskScore: 50,
        physicalForce: 50,
        commandConflicts: 2,
      });
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(5);
    });
  });
});
