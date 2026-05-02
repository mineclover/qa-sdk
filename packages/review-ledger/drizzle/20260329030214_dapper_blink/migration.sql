CREATE TABLE IF NOT EXISTS `review_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`file_path` text NOT NULL,
	`reviewed_commit` text NOT NULL,
	`reviewed_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewer` text NOT NULL,
	`ai_model` text,
	`service_scope` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_re_file` ON `review_entries` (`file_path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_re_scope` ON `review_entries` (`service_scope`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_re_reviewer` ON `review_entries` (`reviewer`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_re_at` ON `review_entries` (`reviewed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_re_file_commit` ON `review_entries` (`file_path`,`reviewed_commit`);
