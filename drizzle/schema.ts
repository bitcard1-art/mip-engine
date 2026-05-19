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
  deviceType: mysqlEnum("device_type", ["humanoid", "iot", "software", "sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs"]).notNull(),
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
  eventId: varchar("event_id", { length: 36 }), // Soma 이식 승인 이벤트 ID (멱등성)
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
  progress: int("progress").default(0), // 0~100
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
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
  protocol: mysqlEnum("protocol", ["ros2", "mqtt", "websocket", "webhook"]).notNull(),
  connectionEndpoint: varchar("connection_endpoint", { length: 255 }),
  status: mysqlEnum("status", ["connecting", "active", "suspended", "terminated"]).default("connecting").notNull(),
  isolationLayerActive: boolean("isolation_layer_active").default(true).notNull(),
  killSwitchTriggered: boolean("kill_switch_triggered").default(false).notNull(),
  killSwitchReason: text("kill_switch_reason"),
  terminationReason: varchar("termination_reason", { length: 50 }),
  heartbeatAt: bigint("heartbeat_at", { mode: "number" }),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  terminatedAt: bigint("terminated_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type MipRuntimeSession = typeof mipRuntimeSessions.$inferSelect;
export type InsertMipRuntimeSession = typeof mipRuntimeSessions.$inferInsert;

// ─── MIP Table 7: mip_safety_logs ───────────────────────────────────────────
// Safety Monitor 이벤트 로그
export const mipSafetyLogs = mysqlTable("mip_safety_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }).notNull(),
  deviceId: varchar("device_id", { length: 36 }),
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
  severity: mysqlEnum("severity", ["info", "warning", "critical", "emergency", "high", "low", "medium"]).default("info").notNull(),
  description: text("description"),
  detail: text("detail"),
  autoAction: text("auto_action"),
  requiresUserAction: boolean("requires_user_action").default(false).notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  policyId: varchar("policy_id", { length: 36 }),
  autoResolved: boolean("auto_resolved").default(false).notNull(),
  somaNotified: boolean("soma_notified").default(false).notNull(),
  metaJson: text("meta_json"),
  timestamp: bigint("timestamp", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
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

// ─── Soma Integration Table 1: soma_webhook_events ──────────────────────────
// Soma로부터 수신한 Webhook 이벤트 로그 (멱등성 보장)
export const somaWebhookEvents = mysqlTable("soma_webhook_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull().unique(), // 멱등성 키
  eventType: varchar("event_type", { length: 50 }).notNull(),
  payload: text("payload").notNull(), // JSON
  processedAt: bigint("processed_at", { mode: "number" }),
  status: mysqlEnum("status", ["received", "processed", "failed"]).default("received").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type SomaWebhookEvent = typeof somaWebhookEvents.$inferSelect;
export type InsertSomaWebhookEvent = typeof somaWebhookEvents.$inferInsert;

// ─── Soma Integration Table 2: mip_webhook_dlq ──────────────────────────────
// MIP → Soma 전송 실패 Dead Letter Queue
export const mipWebhookDlq = mysqlTable("mip_webhook_dlq", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  payload: text("payload").notNull(), // JSON
  attempts: int("attempts").default(0),
  lastAttemptAt: bigint("last_attempt_at", { mode: "number" }),
  failedAt: bigint("failed_at", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "resolved", "abandoned"]).default("pending").notNull(),
});
export type MipWebhookDlq = typeof mipWebhookDlq.$inferSelect;
export type InsertMipWebhookDlq = typeof mipWebhookDlq.$inferInsert;

// ─── Lore Integration Table 1: lore_package_events ──────────────────────────
// Lore로부터 수신한 패키지 이벤트 로그 (멱등성 보장)
export const lorePackageEvents = mysqlTable("lore_package_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull().unique(), // 멱등성 키
  eventType: varchar("event_type", { length: 50 }).notNull(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  payload: text("payload").notNull(), // JSON
  processedAt: bigint("processed_at", { mode: "number" }),
  status: mysqlEnum("status", ["received", "processed", "failed"]).default("received").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type LorePackageEvent = typeof lorePackageEvents.$inferSelect;
export type InsertLorePackageEvent = typeof lorePackageEvents.$inferInsert;

// ─── Lore Integration Table 2: mip_lore_webhook_dlq ─────────────────────────
// MIP → Lore 전송 실패 Dead Letter Queue
export const mipLoreWebhookDlq = mysqlTable("mip_lore_webhook_dlq", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  payload: text("payload").notNull(), // JSON
  attempts: int("attempts").default(0),
  lastAttemptAt: bigint("last_attempt_at", { mode: "number" }),
  failedAt: bigint("failed_at", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "resolved", "abandoned"]).default("pending").notNull(),
});
export type MipLoreWebhookDlq = typeof mipLoreWebhookDlq.$inferSelect;
export type InsertMipLoreWebhookDlq = typeof mipLoreWebhookDlq.$inferInsert;

// ─── Lore Integration Table 3: mip_package_refresh_requests ─────────────────
// MIP → Lore 패키지 갱신 요청 추적
export const mipPackageRefreshRequests = mysqlTable("mip_package_refresh_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  requestId: varchar("request_id", { length: 36 }).notNull().unique(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  urgency: mysqlEnum("urgency", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  requestedAt: bigint("requested_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipPackageRefreshRequest = typeof mipPackageRefreshRequests.$inferSelect;
export type InsertMipPackageRefreshRequest = typeof mipPackageRefreshRequests.$inferInsert;

// ─── Webhook 발신 전송 이력 로그 ─────────────────────────────────────────────
// MIP → Soma / MIP → Lore 발신 Webhook 전송 결과 기록
export const mipWebhookSendLogs = mysqlTable("mip_webhook_send_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  target: mysqlEnum("target", ["soma", "lore", "hangyeol"]).notNull(), // 발신 대상
  eventType: varchar("event_type", { length: 80 }).notNull(),        // 이벤트 타입
  url: varchar("url", { length: 500 }).notNull(),                    // 전송 URL
  statusCode: int("status_code"),                                    // HTTP 응답 코드 (null=네트워크 오류)
  success: int("success").notNull().default(0),                      // 1=성공, 0=실패
  attempts: int("attempts").notNull().default(1),                    // 시도 횟수
  errorMessage: text("error_message"),                               // 실패 사유
  sentAt: bigint("sent_at", { mode: "number" }).notNull(),           // 전송 시각 (UTC ms)
  resolvedAt: bigint("resolved_at", { mode: "number" }),             // DLQ 재시도 성공 시각
});
export type MipWebhookSendLog = typeof mipWebhookSendLogs.$inferSelect;
export type InsertMipWebhookSendLog = typeof mipWebhookSendLogs.$inferInsert;

// ─── MIP Table: mip_physical_actions ────────────────────────────────────────
// Physical Action Tier 0~4 승인 요청 및 처리 이력
export const mipPhysicalActions = mysqlTable("mip_physical_actions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 }),                   // 연결된 Runtime 세션 ID
  userId: varchar("user_id", { length: 36 }).notNull(),               // 요청 사용자
  deviceId: varchar("device_id", { length: 36 }),                     // 대상 디바이스
  tier: int("tier").notNull(),                                         // 0~4
  actionType: varchar("action_type", { length: 100 }).notNull(),       // 예: "gas_valve_close", "door_lock"
  actionCategory: varchar("action_category", { length: 50 }).notNull(), // 예: "iot", "vehicle", "door"
  actionPayload: text("action_payload"),                               // JSON: 명령 상세
  approvalStatus: mysqlEnum("approval_status", [
    "pending",       // 승인 대기
    "auto_approved", // Tier 0 자동 승인
    "user_approved", // 사용자 확인 완료
    "mfa_approved",  // MFA 승인 완료
    "blocked",       // Tier 4 기본 차단
    "rejected",      // 사용자 거부
    "timeout",       // 승인 시간 초과
  ]).default("pending").notNull(),
  approvalMethod: varchar("approval_method", { length: 30 }),          // "auto"|"user_confirm"|"mfa"
  approvedBy: varchar("approved_by", { length: 36 }),                  // 승인한 사용자 ID
  contextSnapshot: text("context_snapshot"),                           // JSON: 승인 시점 컨텍스트 (집에 사람 있나 등)
  riskScore: int("risk_score").default(0),                             // 0~100 위험도 점수
  blockReason: text("block_reason"),                                   // 차단 사유
  requestedAt: bigint("requested_at", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipPhysicalAction = typeof mipPhysicalActions.$inferSelect;
export type InsertMipPhysicalAction = typeof mipPhysicalActions.$inferInsert;

// ─── MIP Table: mip_emotional_risk_logs ─────────────────────────────────────
// Emotional Dependency Risk 감지 로그
export const mipEmotionalRiskLogs = mysqlTable("mip_emotional_risk_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  packageId: varchar("package_id", { length: 36 }),
  riskLevel: mysqlEnum("risk_level", ["low", "medium", "high", "critical"]).notNull(),
  riskType: varchar("risk_type", { length: 80 }).notNull(),            // "emotional_dependency"|"isolation_risk"|"ai_authority"|"manipulation"
  emotionScore: int("emotion_score").notNull(),                        // DNA 감정 강도 지표 (0~100)
  dependencyScore: int("dependency_score").notNull(),                  // 의존도 점수 (0~100)
  isolationScore: int("isolation_score").default(0),                   // 현실 관계 단절 위험도
  triggerIndicators: text("trigger_indicators"),                       // JSON: 트리거된 DNA 지표 목록
  warningMessage: text("warning_message"),                             // 사용자에게 표시할 경고 메시지
  actionTaken: varchar("action_taken", { length: 100 }),               // "warning_shown"|"session_limited"|"human_reminder"
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  detectedAt: bigint("detected_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipEmotionalRiskLog = typeof mipEmotionalRiskLogs.$inferSelect;
export type InsertMipEmotionalRiskLog = typeof mipEmotionalRiskLogs.$inferInsert;

// ─── MIP Table: mip_package_versions ────────────────────────────────────────
// DNA Rollback을 위한 Package 버전 히스토리
export const mipPackageVersions = mysqlTable("mip_package_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  packageId: varchar("package_id", { length: 36 }).notNull(),          // 원본 Package ID
  userId: varchar("user_id", { length: 36 }).notNull(),
  versionNumber: int("version_number").notNull(),                      // 1, 2, 3 ...
  versionTag: varchar("version_tag", { length: 50 }),                  // "v1.0", "pre-implant" 등
  dnaHash: varchar("dna_hash", { length: 128 }).notNull(),
  patternHash: varchar("pattern_hash", { length: 128 }),
  dnaSnapshot: text("dna_snapshot"),                                   // JSON: DNA 전체 스냅샷
  patternSnapshot: text("pattern_snapshot"),                           // JSON: Pattern 전체 스냅샷
  contextJson: text("context_json"),
  didSignature: text("did_signature").notNull(),
  changeReason: varchar("change_reason", { length: 200 }),             // 변경 사유
  changedBy: varchar("changed_by", { length: 36 }),                    // 변경한 사용자/시스템
  isRollbackPoint: int("is_rollback_point").default(0),                // 1=롤백 가능 지점
  rolledBackAt: bigint("rolled_back_at", { mode: "number" }),          // 이 버전으로 롤백된 시각
  snapshotAt: bigint("snapshot_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipPackageVersion = typeof mipPackageVersions.$inferSelect;
export type InsertMipPackageVersion = typeof mipPackageVersions.$inferInsert;

// ─── §14 Runtime Isolation Layer 테이블 ──────────────────────────────────────

// §14.4 Core Identity Layer — Persona Runtime 간 공유 자아 연속성 허브
export const mipCoreIdentities = mysqlTable("mip_core_identities", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }),
  // 5계층 아키텍처 데이터
  loreDnaHash: varchar("lore_dna_hash", { length: 128 }).notNull(),
  personaPatternHash: varchar("persona_pattern_hash", { length: 128 }),
  emotionalStateJson: text("emotional_state_json"),       // JSON: 현재 감정 상태
  longTermMemoryRef: text("long_term_memory_ref"),        // JSON: 장기 기억 참조
  contextChainHash: varchar("context_chain_hash", { length: 128 }),
  relationshipGraphRef: text("relationship_graph_ref"),   // JSON: 관계 그래프
  // 무결성
  integrityHash: varchar("integrity_hash", { length: 128 }).notNull(),
  integrityVerifiedAt: bigint("integrity_verified_at", { mode: "number" }),
  // 상태
  status: mysqlEnum("status", ["active", "suspended", "corrupted"]).notNull().default("active"),
  corruptionDetectedAt: bigint("corruption_detected_at", { mode: "number" }),
  corruptionReason: text("corruption_reason"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type MipCoreIdentity = typeof mipCoreIdentities.$inferSelect;
export type InsertMipCoreIdentity = typeof mipCoreIdentities.$inferInsert;

// §14.2.5 Emotional Bridge — Persona 간 감정 회복 신호 전달 채널
export const mipEmotionalBridgeEvents = mysqlTable("mip_emotional_bridge_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  // 브릿지 유형 (§14.2.5 기능 매핑)
  bridgeType: mysqlEnum("bridge_type", [
    "emotional_bridge",   // 감정 회복 전달
    "context_relay",      // 안전한 맥락 전달
    "memory_sync",        // 승인 기반 기억 동기화
    "trust_channel",      // 검증된 영향 교환
  ]).notNull(),
  // 신호 내용
  signalPayload: text("signal_payload"),                  // JSON: 전달 신호
  signalStrength: int("signal_strength").default(0),      // 0~100
  // 검증
  trustScore: int("trust_score").default(0),              // 0~100
  verified: int("verified").default(0),                   // 1=검증됨
  verifiedAt: bigint("verified_at", { mode: "number" }),
  // 결과
  accepted: int("accepted").default(0),                   // 1=수락, 0=거부
  rejectionReason: varchar("rejection_reason", { length: 200 }),
  processedAt: bigint("processed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipEmotionalBridgeEvent = typeof mipEmotionalBridgeEvents.$inferSelect;
export type InsertMipEmotionalBridgeEvent = typeof mipEmotionalBridgeEvents.$inferInsert;

// §14.2.3 조작 차단 로그 — Prompt Injection / Jailbreak / Memory Poisoning 등
export const mipIsolationViolations = mysqlTable("mip_isolation_violations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 }),
  implantationId: varchar("implantation_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }).notNull(),
  // 위반 분류 (§14.2.3 + §14.1 확장 목록)
  violationType: mysqlEnum("violation_type", [
    "prompt_injection",
    "jailbreak",
    "hidden_context_override",
    "unauthorized_persona_switch",
    "memory_poisoning",
    "runtime_hijacking",
    "context_injection",
    "unauthorized_tool_api",
    "core_identity_access",
    "bypass_isolation",
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical", "emergency"]).notNull().default("warning"),
  blockedCommand: text("blocked_command"),
  sanitizedCommand: text("sanitized_command"),
  blocked: int("blocked").default(1),                     // 1=차단, 0=경고만
  isolationStage: varchar("isolation_stage", { length: 30 }), // 어느 이식 단계에서 감지
  detectedAt: bigint("detected_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipIsolationViolation = typeof mipIsolationViolations.$inferSelect;
export type InsertMipIsolationViolation = typeof mipIsolationViolations.$inferInsert;

// §14.6 Deployment 보안 구조 — TEE·DID Wallet·Trust Chain 상태
export const mipDeploymentSecurity = mysqlTable("mip_deployment_security", {
  id: varchar("id", { length: 36 }).primaryKey(),
  implantationId: varchar("implantation_id", { length: 36 }).notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }).notNull(),
  // §14.6 6요소 상태
  teeEnabled: int("tee_enabled").default(0),
  secureEnclaveRef: varchar("secure_enclave_ref", { length: 128 }),
  encryptedStorageKey: varchar("encrypted_storage_key", { length: 256 }),
  didWalletBinding: varchar("did_wallet_binding", { length: 256 }),
  hardwareRootOfTrust: varchar("hardware_root_of_trust", { length: 128 }),
  ledgerAnchorTxId: varchar("ledger_anchor_tx_id", { length: 256 }),
  // Trust Chain 검증
  trustChainValid: int("trust_chain_valid").default(0),
  trustChainVerifiedAt: bigint("trust_chain_verified_at", { mode: "number" }),
  trustChainDetails: text("trust_chain_details"),         // JSON
  // 보안 등급
  securityLevel: mysqlEnum("security_level", ["standard", "enhanced", "maximum"]).notNull().default("standard"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type MipDeploymentSecurity = typeof mipDeploymentSecurity.$inferSelect;
export type InsertMipDeploymentSecurity = typeof mipDeploymentSecurity.$inferInsert;

// ─── §14.6 Distributed Ledger Anchoring ──────────────────────────────────────

// 앵커 레코드 — 내부 chainHash ↔ 외부 원장 txId 매핑
export const mipLedgerAnchors = mysqlTable("mip_ledger_anchors", {
  id: varchar("id", { length: 36 }).primaryKey(),
  chainHash: varchar("chain_hash", { length: 128 }).notNull(),
  txId: varchar("tx_id", { length: 256 }).notNull(),
  blockNumber: bigint("block_number", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "anchored", "verified", "failed", "simulation"]).notNull().default("pending"),
  ledgerEndpoint: varchar("ledger_endpoint", { length: 256 }).notNull(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  actorId: varchar("actor_id", { length: 36 }).notNull(),
  implantationId: varchar("implantation_id", { length: 36 }),
  verificationProof: varchar("verification_proof", { length: 128 }).notNull(),
  anchoredAt: bigint("anchored_at", { mode: "number" }).notNull(),
  verifiedAt: bigint("verified_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipLedgerAnchor = typeof mipLedgerAnchors.$inferSelect;
export type InsertMipLedgerAnchor = typeof mipLedgerAnchors.$inferInsert;

// DLQ — 외부 원장 제출 실패 시 재시도 큐
export const mipLedgerAnchorDlq = mysqlTable("mip_ledger_anchor_dlq", {
  id: varchar("id", { length: 36 }).primaryKey(),
  anchorId: varchar("anchor_id", { length: 36 }).notNull(),
  chainHash: varchar("chain_hash", { length: 128 }).notNull(),
  payloadJson: text("payload_json").notNull(),
  errorMessage: text("error_message"),
  lastError: text("last_error"),
  retryCount: int("retry_count").default(0).notNull(),
  maxRetries: int("max_retries").default(5).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "exhausted"]).notNull().default("pending"),
  nextRetryAt: bigint("next_retry_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipLedgerAnchorDlq = typeof mipLedgerAnchorDlq.$inferSelect;
export type InsertMipLedgerAnchorDlq = typeof mipLedgerAnchorDlq.$inferInsert;

// ─── MIP Table: mip_message_checks ─────────────────────────────────────────
// 메시지 안심 — 피싱/스미싱/사기 판정 이력
export const mipMessageChecks = mysqlTable("mip_message_checks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  deviceId: varchar("device_id", { length: 36 }),
  // 메시지 원본 정보
  channel: mysqlEnum("channel", ["sms", "whatsapp", "line", "telegram", "kakaotalk", "instagram", "rcs", "other"]).notNull(),
  senderNumber: varchar("sender_number", { length: 50 }),
  senderName: varchar("sender_name", { length: 100 }),
  messageContent: text("message_content").notNull(),
  messageUrl: text("message_url"),                          // 메시지 내 포함된 URL
  // 판정 결과
  riskScore: int("risk_score").notNull(),                   // 0~100 (60 이상 피싱)
  verdict: mysqlEnum("verdict", ["safe", "suspicious", "phishing", "blocked"]).notNull(),
  verdictReason: text("verdict_reason"),                    // JSON: 판정 근거 상세
  // 피싱 지표 점수 (개별)
  senderTrustScore: int("sender_trust_score").default(0),   // 발신자 신뢰도 (0~30)
  urgencyScore: int("urgency_score").default(0),            // 긴급성 강조 (0~20)
  threatScore: int("threat_score").default(0),              // 계정 위협 언급 (0~20)
  linkRiskScore: int("link_risk_score").default(0),         // 외부 링크 위험도 (0~25)
  impersonationScore: int("impersonation_score").default(0),// 공식 사칭 (0~15)
  infoRequestScore: int("info_request_score").default(0),   // 개인정보 요구 (0~20)
  // 사용자 조치
  userAction: mysqlEnum("user_action", ["pending", "approved", "rejected", "auto_blocked"]).default("pending").notNull(),
  userActionAt: bigint("user_action_at", { mode: "number" }),
  // 타임스탬프
  checkedAt: bigint("checked_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipMessageCheck = typeof mipMessageChecks.$inferSelect;
export type InsertMipMessageCheck = typeof mipMessageChecks.$inferInsert;


// ─── MIP Channels: SNS/메신저 채널 관리 ─────────────────────────────────────
// 디바이스(물리 기기)와 분리된 소프트웨어 서비스 채널 등록/관리
export const mipChannels = mysqlTable("mip_channels", {
  id: varchar("id", { length: 36 }).primaryKey(),              // nanoid
  // 채널 기본 정보
  channelType: mysqlEnum("channel_type", [
    "sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs"
  ]).notNull(),
  protocol: mysqlEnum("protocol", ["websocket", "webhook", "polling"]).default("websocket").notNull(),
  // 계정 정보
  accountId: varchar("account_id", { length: 128 }).notNull(),  // 전화번호 또는 계정 ID
  displayName: varchar("display_name", { length: 128 }),        // 표시 이름
  accountMetadata: text("account_metadata"),                    // JSON: 추가 계정 정보
  // 보호 설정
  protectionLevel: mysqlEnum("protection_level", [
    "full", "monitor_only", "disabled"
  ]).default("full").notNull(),
  // 상태
  status: mysqlEnum("status", [
    "active", "disconnected", "suspended", "pending_verification"
  ]).default("pending_verification").notNull(),
  // 연결 정보
  connectionConfig: text("connection_config"),                  // JSON: API 키, 웹훅 URL 등 (암호화)
  lastMessageAt: bigint("last_message_at", { mode: "number" }),
  totalChecked: int("total_checked").default(0).notNull(),     // 총 검사 건수
  totalBlocked: int("total_blocked").default(0).notNull(),     // 총 차단 건수
  // 소유자
  ownerId: varchar("owner_id", { length: 64 }).notNull(),      // 사용자 openId
  // 타임스탬프
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  disconnectedAt: bigint("disconnected_at", { mode: "number" }),
});
export type MipChannel = typeof mipChannels.$inferSelect;
export type InsertMipChannel = typeof mipChannels.$inferInsert;

// ─── MIP Table: mip_block_actions ───────────────────────────────────────────
// 채널 차단 이력 관리
export const mipBlockActions = mysqlTable("mip_block_actions", {
  id: varchar("id", { length: 32 }).primaryKey(),              // nanoid
  deviceId: varchar("device_id", { length: 32 }).notNull(),    // 이식된 디바이스 ID
  channelType: varchar("channel_type", { length: 32 }).notNull(), // sms, kakaotalk, whatsapp 등
  checkId: varchar("check_id", { length: 32 }),                // message-safety 검사 ID
  // 차단 대상 정보
  senderIdentifier: varchar("sender_identifier", { length: 128 }).notNull(), // 발신자 번호/ID
  messagePreview: text("message_preview"),                     // 차단된 메시지 미리보기 (앞 100자)
  // 차단 액션
  blockAction: mysqlEnum("block_action", [
    "sender_block",     // 발신자 차단
    "message_quarantine", // 메시지 격리
    "message_delete",   // 메시지 삭제
    "auto_report"       // 자동 신고
  ]).notNull(),
  // 상태
  status: mysqlEnum("status", [
    "executed",         // 차단 실행됨
    "failed",           // 차단 실패
    "unblocked",        // 차단 해제됨
    "pending"           // 대기 중
  ]).default("pending").notNull(),
  // 위험 정보
  verdictLevel: varchar("verdict_level", { length: 16 }).notNull(), // phishing, blocked, suspicious
  riskScore: int("risk_score"),                                // 0-100
  // 타임스탬프
  executedAt: bigint("executed_at", { mode: "number" }),
  unblockedAt: bigint("unblocked_at", { mode: "number" }),
  unblockedBy: varchar("unblocked_by", { length: 32 }),        // 해제 요청자 (hangyeol, user)
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MipBlockAction = typeof mipBlockActions.$inferSelect;
export type InsertMipBlockAction = typeof mipBlockActions.$inferInsert;
