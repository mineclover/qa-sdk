ALTER TABLE `semantic_terms` ADD COLUMN `version` text;
--> statement-breakpoint
UPDATE `semantic_terms`
SET `version` = `version_id`
WHERE `version` IS NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_semantic_terms_address`;
--> statement-breakpoint
DROP INDEX IF EXISTS `semantic_terms_coord_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_terms_coord_unique`
ON `semantic_terms` (`prefix_id`, `version`, `address`, `kind`, `doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_address`
ON `semantic_terms` (`prefix_id`, `version`, `address`);
