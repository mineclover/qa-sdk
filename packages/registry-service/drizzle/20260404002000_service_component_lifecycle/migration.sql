ALTER TABLE `service_component_version` ADD COLUMN `state` text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE `service_component_version` ADD COLUMN `created_at` text;
--> statement-breakpoint
UPDATE `service_component_version`
SET `created_at` = `updated_at`
WHERE `created_at` IS NULL;
--> statement-breakpoint
ALTER TABLE `service_component_version` ADD COLUMN `published_at` text;
--> statement-breakpoint
ALTER TABLE `service_component_version` ADD COLUMN `deprecated_at` text;
--> statement-breakpoint
ALTER TABLE `service_component_version` ADD COLUMN `archived_at` text;
