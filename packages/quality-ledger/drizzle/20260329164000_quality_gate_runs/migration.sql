CREATE TABLE IF NOT EXISTS `quality_gate_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `gate_doc_id` text NOT NULL,
  `doc_version` integer NOT NULL,
  `bundle_id` text,
  `command` text NOT NULL,
  `outcome` text NOT NULL,
  `exit_code` integer,
  `executed_at` text DEFAULT (datetime('now')) NOT NULL,
  `notes` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_qgr_gate` ON `quality_gate_runs` (`gate_doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_qgr_bundle` ON `quality_gate_runs` (`bundle_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_qgr_executed` ON `quality_gate_runs` (`executed_at`);
