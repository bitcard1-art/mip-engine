ALTER TABLE `mip_safety_logs` MODIFY COLUMN `implantation_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mip_safety_logs` ADD `device_id` varchar(36);