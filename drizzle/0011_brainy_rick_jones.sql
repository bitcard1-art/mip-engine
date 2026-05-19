CREATE TABLE `mip_channels` (
	`id` varchar(36) NOT NULL,
	`channel_type` enum('sms','kakaotalk','whatsapp','line','telegram','instagram','rcs') NOT NULL,
	`protocol` enum('websocket','webhook','polling') NOT NULL DEFAULT 'websocket',
	`account_id` varchar(128) NOT NULL,
	`display_name` varchar(128),
	`account_metadata` text,
	`protection_level` enum('full','monitor_only','disabled') NOT NULL DEFAULT 'full',
	`status` enum('active','disconnected','suspended','pending_verification') NOT NULL DEFAULT 'pending_verification',
	`connection_config` text,
	`last_message_at` bigint,
	`total_checked` int NOT NULL DEFAULT 0,
	`total_blocked` int NOT NULL DEFAULT 0,
	`owner_id` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	`disconnected_at` bigint,
	CONSTRAINT `mip_channels_id` PRIMARY KEY(`id`)
);
