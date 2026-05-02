CREATE TABLE IF NOT EXISTS `policy_rule` (
	`id` text PRIMARY KEY,
	`index_id` text NOT NULL,
	`version_id` text NOT NULL,
	`pattern_json` text NOT NULL,
	`value_json` text NOT NULL,
	`priority` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`rule_set_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_policy_rule_lookup` ON `policy_rule` (`index_id`,`version_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_policy_rule_ruleset` ON `policy_rule` (`index_id`,`version_id`,`rule_set_id`);
