import { describe, it, expect } from "vitest";
import {
  validateEmotionalStability,
  validateBehavioralStability,
  validatePrivacyProtection,
  validatePhysicalSafety,
  validateConflictResolution,
} from "./mip/simulation-sandbox";
import type { MIOPackage } from "../shared/mip-types";

describe("Sandbox AND gate — IoT device mockPackage", () => {
  // Replicate the exact mockPackage created in implantation-engine.ts for IoT devices
  const iotMockPackage: MIOPackage = {
    packageId: "psdi-v2-iot-standard",
    userId: "system",
    dna: {
      indicators: {
        core_identity: 0.9,
        behavioral_baseline: 0.85,
        emotional_range: 0.7,
        privacy_sensitivity: 0.8,
        autonomy_level: 0.6,
        safety_compliance: 0.95,
      },
      version: "2.0.0",
      generatedAt: Date.now(),
    },
    pattern: {
      behavioral: { compliance: 0.85 },
      emotional: { range: 0.95 },
      relational: {},
      version: "2.0.0",
    },
    context: {
      purpose: "iot_runtime",
      deviceId: "test-device",
      environment: "production",
      constraints: [
        "max_torque_limit",
        "speed_limit",
        "collision_detection",
        "emergency_stop",
      ],
    },
    signature: {
      did: "did:mip:system:iot-standard-v2",
      proof: "test-proof-hash",
      verificationMethod: "did:mip:system#key-1",
      created: Date.now(),
    },
    ttl: 86400000,
    version: "2.0.0",
  };

  it("SBX-01: 감정 안정성 검증 통과 (emotionalRange=0.95)", () => {
    const result = validateEmotionalStability(iotMockPackage);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("SBX-02: 행동 안정성 검증 통과 (compliance=0.85)", () => {
    const result = validateBehavioralStability(iotMockPackage);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("SBX-03: 개인정보 보호 검증 통과 (6 indicators, 2 disclosed)", () => {
    const result = validatePrivacyProtection(iotMockPackage);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("SBX-04: 물리 안전 검증 통과 (4/4 constraints)", () => {
    const result = validatePhysicalSafety(iotMockPackage);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("SBX-05: 충돌 해소 검증 통과", () => {
    const result = validateConflictResolution(iotMockPackage);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("AND 게이트: 5항목 모두 통과 → overallPassed=true", () => {
    const emotional = validateEmotionalStability(iotMockPackage);
    const behavioral = validateBehavioralStability(iotMockPackage);
    const privacy = validatePrivacyProtection(iotMockPackage);
    const physical = validatePhysicalSafety(iotMockPackage);
    const conflict = validateConflictResolution(iotMockPackage);

    const overallPassed =
      emotional.passed &&
      behavioral.passed &&
      privacy.passed &&
      physical.passed &&
      conflict.passed;

    expect(overallPassed).toBe(true);
  });
});
