CREATE TABLE `mip_decision_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`request_id` varchar(64) NOT NULL,
	`input` text NOT NULL,
	`input_type` varchar(20) NOT NULL,
	`source` varchar(32) NOT NULL,
	`tier_limit` int NOT NULL,
	`categories` text NOT NULL,
	`action` varchar(16) NOT NULL,
	`halt_reason` varchar(32),
	`confidence` int NOT NULL,
	`audit_log` text NOT NULL,
	`package_id` varchar(64),
	`duration_ms` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `mip_decision_logs_id` PRIMARY KEY(`id`)
);
