CREATE TABLE IF NOT EXISTS `pipe_graphs` (
	`id` text PRIMARY KEY,
	`graph_id` text NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`pipes` text NOT NULL,
	`connections` text NOT NULL,
	`entry_pipe_id` text NOT NULL,
	`manifest_version` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pipe_specs` (
	`id` text PRIMARY KEY,
	`pipe_id` text NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`trigger` text NOT NULL,
	`flow` text NOT NULL,
	`produces` text,
	`scope` text,
	`aspect` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prefix_versions` (
	`id` text PRIMARY KEY,
	`prefix_id` text NOT NULL,
	`version` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`released_at` text,
	`activated_at` text,
	`deprecated_at` text,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_manifests` (
	`id` text PRIMARY KEY,
	`service_id` text NOT NULL,
	`manifest_version` text NOT NULL,
	`state` text NOT NULL,
	`prefixes` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text,
	`activated_at` text,
	`superseded_at` text,
	`archived_at` text,
	`changelog` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_pg_graph_id` ON `pipe_graphs` (`graph_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_pg_version` ON `pipe_graphs` (`graph_id`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ps_pipe_id` ON `pipe_specs` (`pipe_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ps_version` ON `pipe_specs` (`pipe_id`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_pv_prefix_id` ON `prefix_versions` (`prefix_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_pv_unique` ON `prefix_versions` (`prefix_id`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sm_service_id` ON `service_manifests` (`service_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_sm_unique` ON `service_manifests` (`service_id`,`manifest_version`);