CREATE TABLE IF NOT EXISTS `address_range_cache` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`label` text NOT NULL,
	`ranges_json` text NOT NULL,
	`constraints_json` text,
	`computed_at` text NOT NULL,
	CONSTRAINT `address_range_cache_pk` PRIMARY KEY(`prefix`, `version_id`, `label`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `address_state_cache` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`specs_json` text NOT NULL,
	`reserved_json` text NOT NULL,
	`inactive_json` text NOT NULL,
	`open_json` text NOT NULL,
	`computed_at` text NOT NULL,
	CONSTRAINT `address_state_cache_pk` PRIMARY KEY(`prefix`, `version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entry` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `entry_pk` PRIMARY KEY(`prefix`, `version_id`, `position`),
	CONSTRAINT `fk_entry_prefix_version_id_schema_version_prefix_version_id_fk` FOREIGN KEY (`prefix`,`version_id`) REFERENCES `schema_version`(`prefix`,`version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entry_flag` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_entry_flag_prefix_version_id_position_entry_prefix_version_id_position_fk` FOREIGN KEY (`prefix`,`version_id`,`position`) REFERENCES `entry`(`prefix`,`version_id`,`position`),
	CONSTRAINT "entry_flag_status_check" CHECK("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `migration_mapping` (
	`prefix` text NOT NULL,
	`from_version_id` text NOT NULL,
	`to_version_id` text NOT NULL,
	`position` integer NOT NULL,
	`change_type` text NOT NULL,
	`old_entity_id` text,
	`new_entity_id` text,
	`created_at` text NOT NULL,
	CONSTRAINT `migration_mapping_pk` PRIMARY KEY(`prefix`, `from_version_id`, `to_version_id`, `position`),
	CONSTRAINT "migration_mapping_change_type_check" CHECK("change_type" IN ('modified', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prefix_ref` (
	`parent_prefix` text NOT NULL,
	`parent_version_id` text NOT NULL,
	`dim_order` integer NOT NULL,
	`ref_prefix` text NOT NULL,
	`ref_version_id` text NOT NULL,
	`ref_capacity` integer NOT NULL,
	CONSTRAINT `prefix_ref_pk` PRIMARY KEY(`parent_prefix`, `parent_version_id`, `dim_order`),
	CONSTRAINT `fk_prefix_ref_parent_prefix_parent_version_id_prefix_registry_prefix_version_id_fk` FOREIGN KEY (`parent_prefix`,`parent_version_id`) REFERENCES `prefix_registry`(`prefix`,`version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prefix_registry` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`capacity` integer NOT NULL,
	`registered_at` text NOT NULL,
	CONSTRAINT `prefix_registry_pk` PRIMARY KEY(`prefix`, `version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prefix_route` (
	`prefix` text PRIMARY KEY,
	`d1_database_id` text NOT NULL,
	`routed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `schema_version` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`capacity` integer NOT NULL,
	`changelog` text,
	`created_at` text NOT NULL,
	CONSTRAINT `schema_version_pk` PRIMARY KEY(`prefix`, `version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `version_lifecycle` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`status` text NOT NULL,
	`base_version_id` text,
	`capacity` integer NOT NULL,
	`deactivation_mode` text NOT NULL,
	`created_at` text NOT NULL,
	`released_at` text,
	CONSTRAINT `version_lifecycle_pk` PRIMARY KEY(`prefix`, `version_id`),
	CONSTRAINT "version_lifecycle_status_check" CHECK("status" IN ('draft', 'released', 'active', 'deprecated')),
	CONSTRAINT "version_lifecycle_deactivation_mode_check" CHECK("deactivation_mode" IN ('strict', 'flexible'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_range_cache_version` ON `address_range_cache` (`prefix`,`version_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entry_range` ON `entry` (`prefix`,`version_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entry_value` ON `entry` (`prefix`,`version_id`,`value`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entry_flag_lookup` ON `entry_flag` (`prefix`,`version_id`,`position`,`updated_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_migration_mapping_history` ON `migration_mapping` (`prefix`,`position`,`created_at`,`from_version_id`,`to_version_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_migration_mapping_edge` ON `migration_mapping` (`prefix`,`from_version_id`,`to_version_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prefix_route_database` ON `prefix_route` (`d1_database_id`,`routed_at`,`prefix`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_version_lifecycle_prefix_created` ON `version_lifecycle` (`prefix`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_version_lifecycle_prefix_status` ON `version_lifecycle` (`prefix`,`status`,`created_at`);