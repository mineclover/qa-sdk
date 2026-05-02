CREATE TABLE IF NOT EXISTS `feedback_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`requested_by` text NOT NULL,
	`purpose` text NOT NULL,
	`target_model` text,
	`service_scope` text,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text,
	`prompt` text NOT NULL,
	`evidence_bundle` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fr_created` ON `feedback_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fr_scope` ON `feedback_requests` (`service_scope`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fr_status` ON `feedback_requests` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fr_requested_by` ON `feedback_requests` (`requested_by`);
