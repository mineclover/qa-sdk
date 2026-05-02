CREATE TABLE IF NOT EXISTS `axis_profile` (
	`id` text NOT NULL,
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`name` text NOT NULL,
	`current_version` text DEFAULT 'v1' NOT NULL,
	`capacity` integer DEFAULT 32 NOT NULL,
	`entry_count` integer DEFAULT 0 NOT NULL,
	`meta_json` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `axis_profile_pk` PRIMARY KEY(`id`, `catalog_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalogs` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `config` (
	`catalog_id` text NOT NULL,
	`config_type` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `config_pk` PRIMARY KEY(`catalog_id`, `config_type`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `draft_lock` (
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`locked_at` text NOT NULL,
	CONSTRAINT `draft_lock_pk` PRIMARY KEY(`prefix`, `version_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_schema` (
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`service_id` text NOT NULL,
	`event_key` text NOT NULL,
	`event_version` text DEFAULT '1.0.0' NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`record_kind` text DEFAULT 'log' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `event_schema_pk` PRIMARY KEY(`catalog_id`, `service_id`, `event_key`, `event_version`),
	CONSTRAINT "chk_event_schema_record_kind" CHECK(record_kind IN ('log', 'span', 'both')),
	CONSTRAINT "chk_event_schema_status" CHECK(status IN ('active', 'deprecated', 'retired'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prefix` (
	`prefix` text PRIMARY KEY,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`number_type` text DEFAULT 'number' NOT NULL,
	`created_at` text NOT NULL,
	`meta_json` text,
	`labels_json` text,
	CONSTRAINT "chk_prefix_kind" CHECK(kind IN ('leaf', 'composite')),
	CONSTRAINT "chk_prefix_number_type" CHECK(number_type IN ('number', 'bigint'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_endpoint` (
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`namespace` text NOT NULL,
	`svc_name` text NOT NULL,
	`env` text NOT NULL,
	`region` text NOT NULL,
	`url` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `service_endpoint_pk` PRIMARY KEY(`catalog_id`, `namespace`, `svc_name`, `env`, `region`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_schema_service` ON `event_schema` (`catalog_id`,`service_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prefix_owner` ON `prefix` (`owner`);