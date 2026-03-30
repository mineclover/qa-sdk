ALTER TABLE `quality_gate_runs` ADD COLUMN `repo_root` text;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `git_branch` text;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `git_sha` text;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `run_duration_ms` integer;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `success_pattern` text;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `success_pattern_matched` integer;
--> statement-breakpoint
ALTER TABLE `quality_gate_runs` ADD COLUMN `failure_class` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_qgr_git_sha` ON `quality_gate_runs` (`git_sha`);
