CREATE TABLE `persona_card_requests` (
	`id` varchar(36) NOT NULL,
	`requester_service` varchar(50) NOT NULL,
	`requester_ref` varchar(100),
	`subject_did` varchar(128) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`title` varchar(200),
	`organization` varchar(100),
	`bio` text,
	`capabilities` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewed_by` varchar(64),
	`reviewed_at` bigint,
	`rejection_reason` text,
	`issued_card_id` varchar(36),
	`expires_in_days` int DEFAULT 365,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `persona_card_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persona_issued_cards` (
	`id` varchar(36) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`subject_did` varchar(128) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`issuer_did` varchar(128) NOT NULL DEFAULT 'did:mip:issuer:mip-engine-v1',
	`signed_card_json` text NOT NULL,
	`algorithm` varchar(20) NOT NULL DEFAULT 'Ed25519',
	`issued_at` bigint NOT NULL,
	`expires_at` bigint NOT NULL,
	`revoked_at` bigint,
	`issued_by` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `persona_issued_cards_id` PRIMARY KEY(`id`)
);
