CREATE TABLE IF NOT EXISTS `key_observation_prefixes` (
	`prefix_id` text NOT NULL,
	`version` text NOT NULL,
	`distinct_keys` integer DEFAULT 1 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	CONSTRAINT `key_observation_prefixes_pk` PRIMARY KEY(`prefix_id`, `version`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `key_observations` (
	`prefix_id` text NOT NULL,
	`version` text NOT NULL,
	`address` integer NOT NULL,
	`packed_key` text NOT NULL,
	`registered` integer DEFAULT false NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`payload_summary` text DEFAULT '{}' NOT NULL,
	CONSTRAINT `key_observations_pk` PRIMARY KEY(`prefix_id`, `version`, `address`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `runtime_graphs` (
	`trace_id` text PRIMARY KEY,
	`graph` text NOT NULL,
	`node_count` integer NOT NULL,
	`edge_count` integer NOT NULL,
	`built_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scenario_specs` (
	`scenario_id` text PRIMARY KEY,
	`version` text NOT NULL,
	`domain` text NOT NULL,
	`description` text,
	`spec` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_type` text;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_name` text;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_value` real;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_unit` text;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_labels` text;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_buckets` text;--> statement-breakpoint
ALTER TABLE `event_records` ADD `metric_quantiles` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dlq_trace_phase` ON `dead_letter_queue` (`trace_id`,`phase`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_key_obs_packed` ON `key_observations` (`packed_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_key_obs_prefix_version` ON `key_observations` (`prefix_id`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_key_obs_last_seen` ON `key_observations` (`last_seen`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_key_obs_count` ON `key_observations` (`count`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_key_obs_registered` ON `key_observations` (`registered`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_scenario_specs_domain` ON `scenario_specs` (`domain`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verdict_reports_verdict` ON `verdict_reports` (`overall_verdict`);