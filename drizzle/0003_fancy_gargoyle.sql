ALTER TABLE `mip_safety_logs` MODIFY COLUMN `severity` enum('info','warning','critical','emergency','high','low','medium') NOT NULL DEFAULT 'info';--> statement-breakpoint
ALTER TABLE `mip_safety_logs` MODIFY COLUMN `description` text;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` MODIFY COLUMN `timestamp` bigint;--> statement-breakpoint
ALTER TABLE `mip_implantations` ADD `event_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mip_implantations` ADD `progress` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `mip_implantations` ADD `created_at` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_implantations` ADD `updated_at` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_runtime_sessions` ADD `termination_reason` varchar(50);--> statement-breakpoint
ALTER TABLE `mip_runtime_sessions` ADD `created_at` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_runtime_sessions` ADD `updated_at` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `detail` text;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `auto_action` text;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `requires_user_action` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `resolved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `created_at` bigint NOT NULL;