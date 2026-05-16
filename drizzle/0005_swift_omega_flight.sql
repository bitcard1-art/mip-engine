CREATE TABLE `lore_package_events` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`payload` text NOT NULL,
	`processed_at` bigint,
	`status` enum('received','processed','failed') NOT NULL DEFAULT 'received',
	`created_at` bigint NOT NULL,
	CONSTRAINT `lore_package_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `lore_package_events_event_id_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `mip_lore_webhook_dlq` (
	`id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` text NOT NULL,
	`attempts` int DEFAULT 0,
	`last_attempt_at` bigint,
	`failed_at` bigint NOT NULL,
	`resolved_at` bigint,
	`status` enum('pending','resolved','abandoned') NOT NULL DEFAULT 'pending',
	CONSTRAINT `mip_lore_webhook_dlq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mip_package_refresh_requests` (
	`id` varchar(36) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`reason` varchar(50) NOT NULL,
	`urgency` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`requested_at` bigint NOT NULL,
	`completed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_package_refresh_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `mip_package_refresh_requests_request_id_unique` UNIQUE(`request_id`)
);
