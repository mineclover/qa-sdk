CREATE TABLE IF NOT EXISTS `code_references` (
  `code_path` text NOT NULL,
  `doc_id` text NOT NULL,
  `relation_type` text NOT NULL,
  `source_kind` text NOT NULL,
  `symbol` text NOT NULL DEFAULT '',
  `line` integer,
  PRIMARY KEY (`code_path`, `doc_id`, `relation_type`, `source_kind`, `symbol`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_cr_code_path` ON `code_references` (`code_path`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_cr_code_path_symbol` ON `code_references` (`code_path`, `symbol`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_cr_doc_id` ON `code_references` (`doc_id`);
