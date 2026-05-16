import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Core Users Table ───────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── MIP Table 1: mip_devices ────────────────────────────────────────────────
// 등록된 Runtime 디바이스 정보
export const mipDevices = mysqlTable("mip_devices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  deviceType: mysqlEnum("device_type", ["humanoid", "iot", "software"]).notNull(),
  deviceName: varchar("device_name", { length: 100 }).notNull(),
  did: text("did").notNull(),
  trustLevel: int("trust_level").default(0), // 0~3
  status: mysqlEnum("status", ["pending", "verified", "active", "revoked"]).default("pending").notNull(),
  lastSeen: bigint("last_seen", { mode: "number" }),
  metadata: text("metadata"), // JSON
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type MipDevice = typeof mipDevices.$inferSelect;
export type InsertMipDevice = typeof mipDevices.$inferInsert;

// ─── MIP Table 2: mip_packages ───────────────────────────────────────────────
// 수신된 MIO Package 메타데이터
export const mipPackages = mysqlTable("mip_packages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  packageVersion: varchar("package_version", { length: 10 }).default("2.0").notNull(),
  didSignature: text("did_signature").notNull(),
  hmacWatermark: varchar("hmac_watermark", { length: 128 }).notNull(),
  ttl: bigint("ttl", { mode: "number" }).notNull(), // Unix timestamp (만료)
  status: mysqlEnum("status", ["received", "validated", "invalid", "expired"]).default("received").notNull(),
  validationErrors: text("validation_errors"), // JSON array
  dnaHash: varchar("dna_hash", { length: 128 }), // SHA-256 of DNA payload
  patternHash: varchar("pattern_hash", { length: 128 }),
  contextJson: text("context_json"), // RuntimeContext JSON
  sourceSystem: varchar("source_system", { length: 50 }).default("lore").notNull(),
  receivedAt: bigint("received_at", { mode: "number" }).notNull(),
  validatedAt: bigint("validated_at", { mode: "number" }),
});

export type MipPackage = typeof mipPackages.$inferSelect;
export type InsertMipPackage = typeof mipPackages.$inferInsert;

// ─── MIP Table 3: mip_implantations ─────────────────────────────────────────
// 이식 이력 (8단계 상태 전이)
export const mipImplantations = mysqlTable("mip_implantations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  deviceId: varchar("device_id", { length: 36 }).notNull(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  stage: mysqlEnum("stage", [
    "device_registration",
    "trust_verification",
    "user_authentication",
    "package_generation",
    "boundary_injection",
    "runtime_binding",
    "sandbox_validation",
    "live_activation",
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed", "cancelled"]).default("pending").notNull(),
  stageHistory: text("stage_history"), // JSON array of stage transitions
  sandboxReportId: varchar("sandbox_report_id", { length: 36 }),
  activationToken: varchar("activation_token", { length: 128 }),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  errorMessage: text("error_message"),
});

export type MipImplantation = typeof mipImplantations.$inferSelect;
export type InsertMipImplantation = typeof mipImplantations.$inferInsert;

// ─── MIP Table 4: mip_sandbox_reports ───────────────────────────────────────
// Sandbox 검증 결과
export const mipSandboxReports = mysqlTable("mip_sandbox_reports", {
  id: varchar("id", { length: 36 }).primaryKey(),
  implantationId: varchar("implantation_id", { length: 36 }).notNull(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  // 5항목 검증 결과
  emotionalStabilityPassed: boolean("emotional_stability_passed").notNull(),
  emotionalStabilityScore: int("emotional_stability_score").notNull(),
  emotionalStabilityDetails: text("emotional_stability_details"),
  behavioralStabilityPassed: boolean("behavioral_stability_passed").notNull(),
  behavioralStabilityScore: int("behavioral_stability_score").notNull(),
  behavioralStabilityDetails: text("behavioral_stability_details"),
  privacyProtectionPassed: boolean("privacy_protection_passed").notNull(),
  privacyProtectionScore: int("privacy_protection_score").notNull(),
  privacyProtectionDetails: text("privacy_protection_details"),
  physicalSafetyPassed: boolean("physical_safety_passed").notNull(),
  physicalSafetyScore: int("physical_safety_score").notNull(),
  physicalSafetyDetails: text("physical_safety_details"),
  conflictResolutionPassed: boolean("conflict_resolution_passed").notNull(),
  conflictResolutionScore: int("conflict_resolution_score").notNull(),
  conflictResolutionDetails: text("conflict_resolution_details"),
  // AND 게이트 결과
  overallPassed: boolean("overall_passed").notNull(),
  activationAllowed: boolean("activation_allowed").notNull(),
  reportJson: text("report_json").notNull(), // 전체 리포트 JSON
  aisiFormat: boolean("aisi_format").default(false),
  redteamScenario: varchar("redteam_scenario", { length: 100 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type MipSandboxReport = typeof mipSandboxReports.$inferSelect;
export type InsertMipSandboxReport = typeof mipSandboxReports.$inferInsert;

// ─── MIP Table 5: mip_boundary_policies ─────────────────────────────────────
// 사용자별 Ethical Boundary 정책
export const mipBoundaryPolicies = mysqlTable("mip_boundary_policies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }),
  policyType: mysqlEnum("policy_type", ["p_harm", "p_child", "p_unsafe", "p_emotion", "p_learning", "custom"]).notNull(),
  level: mysqlEnum("level", ["strict", "moderate", "permissive"]).default("strict").notNull(),
  triggers: text("triggers").notNull(), // JSON array of trigger keywords/patterns
  action: mysqlEnum("action", ["block", "warn", "log"]).default("block").notNull(),
  standard: varchar("standard", { length: 50 }), // KOSA, EU_AI_ACT 등
  isActive: boolean("is_active").default(true).notNull(),
  violationCount: int("violation_count").default(0).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type MipBoundaryPolicy = typeof mipBoundaryPolicies.$inferSelect;
export type InsertMipBoundaryPolicy = typeof mipBoundaryPolicies.$inferInsert;

// ─── MIP Table 6: mip_runtime_sessions ──────────────────────────────────────
// 활성 Runtime 세션
export const mipRuntimeSessions = mysqlTable("mip_runtime_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  implantationId: varchar("implantation_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  deviceId: varchar("device_id", { length: 36 }).notNull(),
  protocol: mysqlEnum("protocol", ["ros2", "mqtt", "websocket"]).notNull(),
  connectionEndpoint: varchar("connection_endpoint", { length: 255 }),
  status: mysqlEnum("status", ["connecting", "active", "suspended", "terminated"]).default("connecting").notNull(),
  isolationLayerActive: boolean("isolation_layer_active").default(true).notNull(),
  killSwitchTriggered: boolean("kill_switch_triggered").default(false).notNull(),
  killSwitchReason: text("kill_switch_reason"),
  heartbeatAt: bigint("heartbeat_at", { mode: "number" }),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  terminatedAt: bigint("terminated_at", { mode: "number" }),
});

export type MipRuntimeSession = typeof mipRuntimeSessions.$inferSelect;
export type InsertMipRuntimeSession = typeof mipRuntimeSessions.$inferInsert;

// ─── MIP Table 7: mip_safety_logs ───────────────────────────────────────────
// Safety Monitor 이벤트 로그
export const mipSafetyLogs = mysqlTable("mip_safety_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  safetyLevel: int("safety_level").notNull(), // 1~5
  eventType: mysqlEnum("event_type", [
    "anomaly_detected",
    "policy_violation",
    "emotion_overflow",
    "physical_limit_exceeded",
    "kill_switch_activated",
    "hardware_signal_sent",
    "soma_notified",
    "threshold_adjusted",
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical", "emergency"]).default("info").notNull(),
  description: text("description").notNull(),
  policyId: varchar("policy_id", { length: 36 }),
  autoResolved: boolean("auto_resolved").default(false).notNull(),
  somaNotified: boolean("soma_notified").default(false).notNull(),
  metaJson: text("meta_json"), // 추가 메타데이터 JSON
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export type MipSafetyLog = typeof mipSafetyLogs.$inferSelect;
export type InsertMipSafetyLog = typeof mipSafetyLogs.$inferInsert;

// ─── MIP Table 8: mip_audit_chain ───────────────────────────────────────────
// 감사 로그 해시 체인 (무결성)
export const mipAuditChain = mysqlTable("mip_audit_chain", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  entityType: mysqlEnum("entity_type", [
    "implantation",
    "device",
    "package",
    "sandbox_report",
    "safety_log",
    "policy",
    "session",
  ]).notNull(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  actorId: varchar("actor_id", { length: 36 }).notNull(), // userId or system
  dataHash: varchar("data_hash", { length: 128 }).notNull(), // SHA-256
  previousHash: varchar("previous_hash", { length: 128 }), // 이전 체인 항목 해시
  chainHash: varchar("chain_hash", { length: 128 }).notNull(), // 현재 체인 해시
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export type MipAuditChain = typeof mipAuditChain.$inferSelect;
export type InsertMipAuditChain = typeof mipAuditChain.$inferInsert;
