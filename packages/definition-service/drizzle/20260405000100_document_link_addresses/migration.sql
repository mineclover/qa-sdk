ALTER TABLE `document_links` ADD COLUMN `source_address` text;
--> statement-breakpoint
ALTER TABLE `document_links` ADD COLUMN `target_address` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dl_source_address` ON `document_links` (`source_address`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dl_target_address` ON `document_links` (`target_address`);
