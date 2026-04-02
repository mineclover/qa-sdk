CREATE TABLE IF NOT EXISTS `data_object_bindings` (
	`schema_id` text PRIMARY KEY,
	`prefix_id` text NOT NULL,
	`prefix_version` text NOT NULL,
	`column_to_axis` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lineage_validations` (
	`id` text PRIMARY KEY,
	`schema_id` text NOT NULL,
	`validated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`bound` integer NOT NULL,
	`unbound` integer NOT NULL,
	`mismatched` integer NOT NULL,
	`details` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dob_prefix_id` ON `data_object_bindings` (`prefix_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dob_prefix_version` ON `data_object_bindings` (`prefix_id`,`prefix_version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lv_schema_id` ON `lineage_validations` (`schema_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lv_schema_validated_at` ON `lineage_validations` (`schema_id`,`validated_at`);
