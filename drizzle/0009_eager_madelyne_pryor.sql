CREATE TABLE `mip_ledger_anchor_dlq` (
	`id` varchar(36) NOT NULL,
	`anchor_id` varchar(36) NOT NULL,
	`chain_hash` varchar(128) NOT NULL,
	`payload_json` text NOT NULL,
	`error_message` text,
	`last_error` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`max_retries` int NOT NULL DEFAULT 5,
	`status` enum('pending','completed','exhausted') NOT NULL DEFAULT 'pending',
	`next_retry_at` bigint NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_ledger_anchor_dlq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_ledger_anchors` (
	`id` varchar(36) NOT NULL,
	`chain_hash` varchar(128) NOT NULL,
	`tx_id` varchar(256) NOT NULL,
	`block_number` bigint,
	`status` enum('pending','anchored','verified','failed','simulation') NOT NULL DEFAULT 'pending',
	`ledger_endpoint` varchar(256) NOT NULL,
	`entity_type` varchar(30) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`action` varchar(50) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`implantation_id` varchar(36),
	`verification_proof` varchar(128) NOT NULL,
	`anchored_at` bigint NOT NULL,
	`verified_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_ledger_anchors_id` PRIMARY KEY(`id`)
);
