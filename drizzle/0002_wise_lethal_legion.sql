CREATE TABLE `mip_webhook_dlq` (
	`id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` text NOT NULL,
	`attempts` int DEFAULT 0,
	`last_attempt_at` bigint,
	`failed_at` bigint NOT NULL,
	`resolved_at` bigint,
	`status` enum('pending','resolved','abandoned') NOT NULL DEFAULT 'pending',
	CONSTRAINT `mip_webhook_dlq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `soma_webhook_events` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` text NOT NULL,
	`processed_at` bigint,
	`status` enum('received','processed','failed') NOT NULL DEFAULT 'received',
	`created_at` bigint NOT NULL,
	CONSTRAINT `soma_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `soma_webhook_events_event_id_unique` UNIQUE(`event_id`)
);
