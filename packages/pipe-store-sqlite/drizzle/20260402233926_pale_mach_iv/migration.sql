CREATE TABLE IF NOT EXISTS `facet_code_mappings` (
	`facet` text PRIMARY KEY,
	`implementations` text NOT NULL,
	`schema_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fcm_schema_id` ON `facet_code_mappings` (`schema_id`);