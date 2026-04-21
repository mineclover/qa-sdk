-- Phase C-0 (aspect-schema-hierarchy RFC): aspect_parents metadata table
-- 자식 aspect → 부모 aspect 매핑. Source of truth: definition-catalog/src/vocabulary.ts §ASPECT_PARENTS.
CREATE TABLE IF NOT EXISTS `aspect_parents` (
	`child_id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`description` text,
	`registered_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ap_parent` ON `aspect_parents` (`parent_id`);
