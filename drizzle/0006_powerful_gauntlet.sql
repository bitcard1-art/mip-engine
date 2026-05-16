CREATE TABLE `mip_webhook_send_logs` (
	`id` varchar(36) NOT NULL,
	`target` enum('soma','lore') NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`url` varchar(500) NOT NULL,
	`status_code` int,
	`success` int NOT NULL DEFAULT 0,
	`attempts` int NOT NULL DEFAULT 1,
	`error_message` text,
	`sent_at` bigint NOT NULL,
	`resolved_at` bigint,
	CONSTRAINT `mip_webhook_send_logs_id` PRIMARY KEY(`id`)
);
