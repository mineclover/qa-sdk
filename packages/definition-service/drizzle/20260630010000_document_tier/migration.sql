ALTER TABLE `documents` ADD `tier` text;
--> statement-breakpoint
ALTER TABLE `document_history` ADD `tier` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_doc_tier` ON `documents` (`tier`);
