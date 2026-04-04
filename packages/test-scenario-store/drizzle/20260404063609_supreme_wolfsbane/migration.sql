CREATE TABLE `test_scenario_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`scenario_id` text NOT NULL,
	`passed` integer NOT NULL,
	`commit_hash` text,
	`duration_ms` integer,
	`run_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_scenarios` (
	`id` text PRIMARY KEY,
	`a_coord` text NOT NULL UNIQUE,
	`spec_address` text NOT NULL,
	`kind` text NOT NULL,
	`scope` text DEFAULT 'single' NOT NULL,
	`lifecycle` text DEFAULT 'declared' NOT NULL,
	`intent` text NOT NULL,
	`primary_svc` text NOT NULL,
	`participants` text DEFAULT '[]' NOT NULL,
	`file_path` text,
	`simulation_ref` text,
	`spec_version` text,
	`convention_violation` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tsr_scenario` ON `test_scenario_runs` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_tsr_run_at` ON `test_scenario_runs` (`run_at`);--> statement-breakpoint
CREATE INDEX `idx_ts_spec` ON `test_scenarios` (`spec_address`);--> statement-breakpoint
CREATE INDEX `idx_ts_kind` ON `test_scenarios` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_ts_lifecycle` ON `test_scenarios` (`lifecycle`);