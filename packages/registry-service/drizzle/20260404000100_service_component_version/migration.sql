CREATE TABLE IF NOT EXISTS `service_component_version` (
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`kind` text NOT NULL,
	`service_id` text NOT NULL,
	`version` text NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `service_component_version_pk` PRIMARY KEY(`catalog_id`, `kind`, `service_id`, `version`),
	CONSTRAINT "chk_service_component_kind" CHECK(kind IN ('service-unit', 'ownership', 'exposure', 'runtime-address', 'deployment-binding'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_service_component_lookup` ON `service_component_version` (`catalog_id`,`service_id`,`kind`);
