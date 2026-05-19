CREATE TABLE `mip_block_actions` (
	`id` varchar(32) NOT NULL,
	`device_id` varchar(32) NOT NULL,
	`channel_type` varchar(32) NOT NULL,
	`check_id` varchar(32),
	`sender_identifier` varchar(128) NOT NULL,
	`message_preview` text,
	`block_action` enum('sender_block','message_quarantine','message_delete','auto_report') NOT NULL,
	`status` enum('executed','failed','unblocked','pending') NOT NULL DEFAULT 'pending',
	`verdict_level` varchar(16) NOT NULL,
	`risk_score` int,
	`executed_at` bigint,
	`unblocked_at` bigint,
	`unblocked_by` varchar(32),
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_block_actions_id` PRIMARY KEY(`id`)
);
