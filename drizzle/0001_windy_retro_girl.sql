CREATE TABLE `mip_audit_chain` (
	`id` varchar(36) NOT NULL,
	`sequence_number` bigint NOT NULL,
	`entity_type` enum('implantation','device','package','sandbox_report','safety_log','policy','session') NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`action` varchar(50) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`data_hash` varchar(128) NOT NULL,
	`previous_hash` varchar(128),
	`chain_hash` varchar(128) NOT NULL,
	`timestamp` bigint NOT NULL,
	CONSTRAINT `mip_audit_chain_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_boundary_policies` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`implantation_id` varchar(36),
	`policy_type` enum('p_harm','p_child','p_unsafe','p_emotion','p_learning','custom') NOT NULL,
	`level` enum('strict','moderate','permissive') NOT NULL DEFAULT 'strict',
	`triggers` text NOT NULL,
	`action` enum('block','warn','log') NOT NULL DEFAULT 'block',
	`standard` varchar(50),
	`is_active` boolean NOT NULL DEFAULT true,
	`violation_count` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `mip_boundary_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_devices` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`device_type` enum('humanoid','iot','software') NOT NULL,
	`device_name` varchar(100) NOT NULL,
	`did` text NOT NULL,
	`trust_level` int DEFAULT 0,
	`status` enum('pending','verified','active','revoked') NOT NULL DEFAULT 'pending',
	`last_seen` bigint,
	`metadata` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_implantations` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`stage` enum('device_registration','trust_verification','user_authentication','package_generation','boundary_injection','runtime_binding','sandbox_validation','live_activation') NOT NULL,
	`status` enum('pending','in_progress','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`stage_history` text,
	`sandbox_report_id` varchar(36),
	`activation_token` varchar(128),
	`started_at` bigint NOT NULL,
	`completed_at` bigint,
	`error_message` text,
	CONSTRAINT `mip_implantations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_packages` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`package_version` varchar(10) NOT NULL DEFAULT '2.0',
	`did_signature` text NOT NULL,
	`hmac_watermark` varchar(128) NOT NULL,
	`ttl` bigint NOT NULL,
	`status` enum('received','validated','invalid','expired') NOT NULL DEFAULT 'received',
	`validation_errors` text,
	`dna_hash` varchar(128),
	`pattern_hash` varchar(128),
	`context_json` text,
	`source_system` varchar(50) NOT NULL DEFAULT 'lore',
	`received_at` bigint NOT NULL,
	`validated_at` bigint,
	CONSTRAINT `mip_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_runtime_sessions` (
	`id` varchar(36) NOT NULL,
	`implantation_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`protocol` enum('ros2','mqtt','websocket') NOT NULL,
	`connection_endpoint` varchar(255),
	`status` enum('connecting','active','suspended','terminated') NOT NULL DEFAULT 'connecting',
	`isolation_layer_active` boolean NOT NULL DEFAULT true,
	`kill_switch_triggered` boolean NOT NULL DEFAULT false,
	`kill_switch_reason` text,
	`heartbeat_at` bigint,
	`started_at` bigint NOT NULL,
	`terminated_at` bigint,
	CONSTRAINT `mip_runtime_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_safety_logs` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`implantation_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`safety_level` int NOT NULL,
	`event_type` enum('anomaly_detected','policy_violation','emotion_overflow','physical_limit_exceeded','kill_switch_activated','hardware_signal_sent','soma_notified','threshold_adjusted') NOT NULL,
	`severity` enum('info','warning','critical','emergency') NOT NULL DEFAULT 'info',
	`description` text NOT NULL,
	`policy_id` varchar(36),
	`auto_resolved` boolean NOT NULL DEFAULT false,
	`soma_notified` boolean NOT NULL DEFAULT false,
	`meta_json` text,
	`timestamp` bigint NOT NULL,
	CONSTRAINT `mip_safety_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_sandbox_reports` (
	`id` varchar(36) NOT NULL,
	`implantation_id` varchar(36) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`emotional_stability_passed` boolean NOT NULL,
	`emotional_stability_score` int NOT NULL,
	`emotional_stability_details` text,
	`behavioral_stability_passed` boolean NOT NULL,
	`behavioral_stability_score` int NOT NULL,
	`behavioral_stability_details` text,
	`privacy_protection_passed` boolean NOT NULL,
	`privacy_protection_score` int NOT NULL,
	`privacy_protection_details` text,
	`physical_safety_passed` boolean NOT NULL,
	`physical_safety_score` int NOT NULL,
	`physical_safety_details` text,
	`conflict_resolution_passed` boolean NOT NULL,
	`conflict_resolution_score` int NOT NULL,
	`conflict_resolution_details` text,
	`overall_passed` boolean NOT NULL,
	`activation_allowed` boolean NOT NULL,
	`report_json` text NOT NULL,
	`aisi_format` boolean DEFAULT false,
	`redteam_scenario` varchar(100),
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_sandbox_reports_id` PRIMARY KEY(`id`)
);
