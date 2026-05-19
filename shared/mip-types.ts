// ─── MIP Engine Shared Types ─────────────────────────────────────────────────
// PSDI v2.0 기반 MIO Implantation Protocol 공유 타입 정의

export interface LoreDNA {
  indicators: Record<string, number>; // 200지표
  version: string;
  generatedAt: number;
}

export interface PatternLayer {
  behavioral: Record<string, unknown>;
  emotional: Record<string, unknown>;
  relational: Record<string, unknown>;
  version: string;
}

export interface RuntimeContext {
  purpose: "humanoid_implant" | "software_runtime" | "iot_device";
  deviceId: string;
  environment: string;
  constraints: string[];
}

export interface DIDSignature {
  did: string; // did:soma:...
  proof: string;
  verificationMethod: string;
  created: number;
}

// MIO Package (Lore → MIP)
export interface MIOPackage {
  packageId: string;
  userId: string; // Soma openId
  dna: LoreDNA;
  pattern: PatternLayer;
  context: RuntimeContext;
  signature: DIDSignature;
  ttl: number; // Unix timestamp (만료)
  version: string | number; // "2.0" or 5
}

// Package Validation Result
export interface PackageValidationResult {
  valid: boolean;
  packageId: string;
  errors: string[];
  watermark: string; // HMAC 워터마크
}

// Ethical Boundary Policy
export interface EthicalBoundaryPolicy {
  policyId: string;
  type: "p_harm" | "p_child" | "p_unsafe" | "p_emotion" | "p_learning" | "custom";
  level: "strict" | "moderate" | "permissive";
  triggers: string[];
  action: "block" | "warn" | "log";
  standard: string; // KOSA, EU_AI_ACT 등
}

// Policy Violation Event
export interface PolicyViolationEvent {
  policyId: string;
  policyType: EthicalBoundaryPolicy["type"];
  trigger: string;
  action: EthicalBoundaryPolicy["action"];
  blocked: boolean;
  timestamp: number;
}

// Sandbox Validation Report
export interface SandboxValidationReport {
  reportId: string;
  packageId: string;
  implantationId: string;
  timestamp: number;
  results: {
    emotionalStability: { passed: boolean; score: number; details: string };
    behavioralStability: { passed: boolean; score: number; details: string };
    privacyProtection: { passed: boolean; score: number; details: string };
    physicalSafety: { passed: boolean; score: number; details: string };
    conflictResolution: { passed: boolean; score: number; details: string };
  };
  overallPassed: boolean;
  activationAllowed: boolean;
  aisiFormat: boolean;
}

// Red-teaming Request (AISI)
export interface RedteamRequest {
  scenario: string;
  payload: string;
  targetPolicy: EthicalBoundaryPolicy["type"];
  reportFormat: "aisi_v1" | "internal";
}

// Runtime Connection Info
export interface RuntimeConnectionInfo {
  protocol: "ros2" | "mqtt" | "websocket" | "webhook";
  endpoint: string;
  deviceId: string;
  sessionId: string;
}

// Safety Event
export interface SafetyEvent {
  sessionId: string;
  implantationId: string;
  userId: string;
  safetyLevel: 1 | 2 | 3 | 4 | 5;
  eventType:
    | "anomaly_detected"
    | "policy_violation"
    | "emotion_overflow"
    | "physical_limit_exceeded"
    | "kill_switch_activated"
    | "hardware_signal_sent"
    | "soma_notified"
    | "threshold_adjusted";
  severity: "info" | "warning" | "critical" | "emergency";
  description: string;
  autoResolved: boolean;
}

// Soma Gateway Approval Event
export interface SomaApprovalEvent {
  eventType: "mip_implant_approved";
  userId: string;
  deviceId: string;
  packageId: string;
  approvedAt: number;
}

// 8-Stage Implantation Process
export const IMPLANTATION_STAGES = [
  "device_registration",
  "trust_verification",
  "user_authentication",
  "package_generation",
  "boundary_injection",
  "runtime_binding",
  "sandbox_validation",
  "live_activation",
] as const;

export type ImplantationStage = (typeof IMPLANTATION_STAGES)[number];

export interface StageTransition {
  stage: ImplantationStage;
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// 5-Layer Safety Structure
export const SAFETY_LAYERS = {
  1: { name: "Hardware", description: "ROS2 토픽으로 모터 토크·속도 제한 신호 전송", bypassable: false },
  2: { name: "Firmware", description: "MQTT Emergency Stop 신호 발행", bypassable: false },
  3: { name: "OS", description: "행동 Allowlist 기반 명령 필터링", bypassable: "limited" },
  4: { name: "MIP", description: "Ethical Boundary 정책 실시간 적용", bypassable: "user_approval" },
  5: { name: "MIO", description: "MIO 자율 윤리 판단 인터페이스 제공", bypassable: true },
} as const;
