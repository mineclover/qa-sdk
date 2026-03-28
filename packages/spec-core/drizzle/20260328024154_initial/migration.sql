CREATE TABLE IF NOT EXISTS `dkg_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`source` text DEFAULT 'bootstrap' NOT NULL,
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`meta` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dkg_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dkg_nodes` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`source` text DEFAULT 'bootstrap' NOT NULL,
	`catalog_id` text DEFAULT 'demo' NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`collected_at` text DEFAULT (datetime('now')) NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`total_records` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `version_usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`snapshot_id` integer NOT NULL,
	`prefix` text NOT NULL,
	`version` text NOT NULL,
	`count` integer NOT NULL,
	`last_seen` text NOT NULL,
	`sessions` text NOT NULL,
	CONSTRAINT `fk_version_usages_snapshot_id_usage_snapshots_id_fk` FOREIGN KEY (`snapshot_id`) REFERENCES `usage_snapshots`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_edges_from` ON `dkg_edges` (`from_id`,`type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_edges_to` ON `dkg_edges` (`to_id`,`type`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_dkg_edges_unique` ON `dkg_edges` (`type`,`from_id`,`to_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_edges_catalog` ON `dkg_edges` (`catalog_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_nodes_kind` ON `dkg_nodes` (`kind`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_nodes_source` ON `dkg_nodes` (`source`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dkg_nodes_catalog` ON `dkg_nodes` (`catalog_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_version_usages_prefix` ON `version_usages` (`prefix`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_version_usages_snapshot` ON `version_usages` (`snapshot_id`);