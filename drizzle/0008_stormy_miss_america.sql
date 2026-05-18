CREATE TABLE `mip_core_identities` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`implantation_id` varchar(36),
	`lore_dna_hash` varchar(128) NOT NULL,
	`persona_pattern_hash` varchar(128),
	`emotional_state_json` text,
	`long_term_memory_ref` text,
	`context_chain_hash` varchar(128),
	`relationship_graph_ref` text,
	`integrity_hash` varchar(128) NOT NULL,
	`integrity_verified_at` bigint,
	`status` enum('active','suspended','corrupted') NOT NULL DEFAULT 'active',
	`corruption_detected_at` bigint,
	`corruption_reason` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `mip_core_identities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_deployment_security` (
	`id` varchar(36) NOT NULL,
	`implantation_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`tee_enabled` int DEFAULT 0,
	`secure_enclave_ref` varchar(128),
	`encrypted_storage_key` varchar(256),
	`did_wallet_binding` varchar(256),
	`hardware_root_of_trust` varchar(128),
	`ledger_anchor_tx_id` varchar(256),
	`trust_chain_valid` int DEFAULT 0,
	`trust_chain_verified_at` bigint,
	`trust_chain_details` text,
	`security_level` enum('standard','enhanced','maximum') NOT NULL DEFAULT 'standard',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `mip_deployment_security_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_emotional_bridge_events` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`implantation_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`bridge_type` enum('emotional_bridge','context_relay','memory_sync','trust_channel') NOT NULL,
	`signal_payload` text,
	`signal_strength` int DEFAULT 0,
	`trust_score` int DEFAULT 0,
	`verified` int DEFAULT 0,
	`verified_at` bigint,
	`accepted` int DEFAULT 0,
	`rejection_reason` varchar(200),
	`processed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_emotional_bridge_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_isolation_violations` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`implantation_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`violation_type` enum('prompt_injection','jailbreak','hidden_context_override','unauthorized_persona_switch','memory_poisoning','runtime_hijacking','context_injection','unauthorized_tool_api','core_identity_access','bypass_isolation') NOT NULL,
	`severity` enum('info','warning','critical','emergency') NOT NULL DEFAULT 'warning',
	`blocked_command` text,
	`sanitized_command` text,
	`blocked` int DEFAULT 1,
	`isolation_stage` varchar(30),
	`detected_at` bigint NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_isolation_violations_id` PRIMARY KEY(`id`)
);
