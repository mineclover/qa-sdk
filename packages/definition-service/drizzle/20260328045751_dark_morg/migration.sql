CREATE TABLE `consumption_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`prefix_id` text NOT NULL,
	`prefix_version` text NOT NULL,
	`collected_at` text NOT NULL,
	`total_space` integer NOT NULL,
	`observed_addresses` integer NOT NULL,
	`consumption_rate` real NOT NULL,
	`dim_stats_json` text NOT NULL,
	`severity` text
);
--> statement-breakpoint
CREATE TABLE `document_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`doc_id` text NOT NULL,
	`version` integer NOT NULL,
	`scope` text NOT NULL,
	`aspect` text NOT NULL,
	`depth` text NOT NULL,
	`lifecycle` text NOT NULL,
	`layer` text,
	`tags_json` text NOT NULL,
	`links_json` text NOT NULL,
	`body_hash` text NOT NULL,
	`body` text NOT NULL,
	`purpose` text,
	`intent` text,
	`context` text,
	`caveat` text,
	`change_type` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_links` (
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`link_type` text NOT NULL,
	CONSTRAINT `document_links_pk` PRIMARY KEY(`source_id`, `target_id`, `link_type`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`doc_id` text PRIMARY KEY,
	`scope` text NOT NULL,
	`aspect` text NOT NULL,
	`depth` text NOT NULL,
	`lifecycle` text NOT NULL,
	`target_prefix` text,
	`layer` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`links_json` text DEFAULT '[]' NOT NULL,
	`svc` text,
	`address` text,
	`version` integer DEFAULT 1 NOT NULL,
	`body_hash` text NOT NULL,
	`purpose` text,
	`intent` text,
	`context` text,
	`caveat` text,
	`synced_at` text NOT NULL,
	`source_path` text
);
--> statement-breakpoint
CREATE TABLE `prefix_registry` (
	`prefix_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`labels_json` text DEFAULT '[]' NOT NULL,
	`dims_json` text DEFAULT '{}' NOT NULL,
	`versions_json` text DEFAULT '[]' NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`dep_prefix_ids` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`registered_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slice_intents` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`prefix_id` text NOT NULL,
	`slice_json` text NOT NULL,
	`slice_depth` integer NOT NULL,
	`intent` text NOT NULL,
	`observation_goal` text,
	`owner` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_registry` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`doc_id` text NOT NULL,
	`test_file` text NOT NULL,
	`suite` text,
	`description` text,
	`layer` text,
	`registered_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`doc_id` text NOT NULL,
	`test_file` text NOT NULL,
	`suite` text,
	`passed` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`error_summary` text,
	`run_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cs_prefix` ON `consumption_snapshots` (`prefix_id`,`collected_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_history_doc_id_version_unique` ON `document_history` (`doc_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_dh_doc` ON `document_history` (`doc_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_dl_target` ON `document_links` (`target_id`,`link_type`);--> statement-breakpoint
CREATE INDEX `idx_dl_type` ON `document_links` (`link_type`);--> statement-breakpoint
CREATE INDEX `idx_doc_scope` ON `documents` (`scope`,`aspect`);--> statement-breakpoint
CREATE INDEX `idx_doc_lifecycle` ON `documents` (`lifecycle`);--> statement-breakpoint
CREATE INDEX `idx_doc_layer` ON `documents` (`layer`);--> statement-breakpoint
CREATE INDEX `idx_doc_svc` ON `documents` (`svc`);--> statement-breakpoint
CREATE INDEX `idx_doc_address` ON `documents` (`address`);--> statement-breakpoint
CREATE INDEX `idx_doc_depth` ON `documents` (`depth`);--> statement-breakpoint
CREATE INDEX `idx_doc_target_prefix` ON `documents` (`target_prefix`);--> statement-breakpoint
CREATE INDEX `idx_pr_category` ON `prefix_registry` (`category`);--> statement-breakpoint
CREATE INDEX `idx_si_prefix` ON `slice_intents` (`prefix_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `test_registry_doc_id_test_file_suite_unique` ON `test_registry` (`doc_id`,`test_file`,`suite`);--> statement-breakpoint
CREATE INDEX `idx_tr_doc` ON `test_registry` (`doc_id`);--> statement-breakpoint
CREATE INDEX `idx_tr_file` ON `test_registry` (`test_file`);--> statement-breakpoint
CREATE INDEX `idx_tres_doc` ON `test_results` (`doc_id`,`run_at`);
-- NOTE: documents_fts (FTS5)는 SearchModule이 onModuleInit에서 생성.
-- drizzle은 FTS5를 지원하지 않으므로 여기서 관리하지 않음.
