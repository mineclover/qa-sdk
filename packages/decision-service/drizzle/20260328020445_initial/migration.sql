CREATE TABLE IF NOT EXISTS `flow_instances` (
	`id` text PRIMARY KEY,
	`schema_id` text NOT NULL,
	`schema_version` text NOT NULL,
	`status` text NOT NULL,
	`context_json` text DEFAULT '{}' NOT NULL,
	`selections_json` text DEFAULT '[]' NOT NULL,
	`outcome_json` text,
	`address` integer,
	`address_context` text,
	`verdict` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `flow_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`instance_id` text NOT NULL,
	`doc_id` text NOT NULL,
	`link_type` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `flow_schemas` (
	`schema_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`version` text DEFAULT 'v1' NOT NULL,
	`gates_json` text DEFAULT '[]' NOT NULL,
	`outcomes_json` text DEFAULT '[]' NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`registered_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_schema` ON `flow_instances` (`schema_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_status` ON `flow_instances` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fi_started` ON `flow_instances` (`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_fl_unique` ON `flow_links` (`instance_id`,`doc_id`,`link_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fl_instance` ON `flow_links` (`instance_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fl_doc` ON `flow_links` (`doc_id`);