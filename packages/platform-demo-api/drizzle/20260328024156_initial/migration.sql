CREATE TABLE IF NOT EXISTS `grants` (
	`feature_id` text NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT `grants_pk` PRIMARY KEY(`feature_id`, `role`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`ts` text NOT NULL,
	`level` text NOT NULL,
	`svc_addr` integer NOT NULL,
	`perm_addr` integer,
	`evt_addr` integer,
	`action` text NOT NULL,
	`message` text NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_logs_ts` ON `logs` (`ts`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_logs_level` ON `logs` (`level`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_logs_svc_addr` ON `logs` (`svc_addr`);