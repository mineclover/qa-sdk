CREATE TABLE IF NOT EXISTS `flow_instances` (
	`id` text PRIMARY KEY,
	`schema_id` text NOT NULL,
	`schema_version` text NOT NULL,
	`status` text NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`selections` text DEFAULT '[]' NOT NULL,
	`outcome` text,
	`address` integer,
	`address_context` text,
	`verdict` text,
	`test_plan` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_schema` ON `flow_instances` (`schema_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_status` ON `flow_instances` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_started` ON `flow_instances` (`started_at`);
