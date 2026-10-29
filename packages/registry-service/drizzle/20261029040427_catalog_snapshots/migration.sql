CREATE TABLE `catalog_snapshots` (
	`digest` text PRIMARY KEY,
	`catalog_id` text NOT NULL,
	`snapshot_version` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_catalog_snapshots_version` ON `catalog_snapshots` (`catalog_id`,`snapshot_version`);