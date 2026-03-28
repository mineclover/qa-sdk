CREATE TABLE IF NOT EXISTS `dead_letter_queue` (
	`id` text PRIMARY KEY,
	`trace_id` text NOT NULL,
	`phase` text NOT NULL,
	`error_message` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempted_at` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_records` (
	`log_id` text PRIMARY KEY,
	`trace_id` text NOT NULL,
	`span_id` text NOT NULL,
	`parent_span_id` text,
	`timestamp` text NOT NULL,
	`record_kind` text NOT NULL,
	`event_key` text NOT NULL,
	`event_version` text NOT NULL,
	`span_name` text,
	`start_time` text,
	`end_time` text,
	`status_code` text,
	`payload_format` text NOT NULL,
	`payload_encoding` text NOT NULL,
	`payload_masking_applied` integer DEFAULT false NOT NULL,
	`payload_masked_fields` text DEFAULT '[]' NOT NULL,
	`payload` text,
	`registry_warning` text,
	`address_context` text,
	`qa_session_id` text,
	`actor_id` text,
	`user_id` text,
	`user_attributes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insight_labels` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `qa_sessions` (
	`session_id` text PRIMARY KEY,
	`scenario_id` text,
	`labels` text,
	`actor_id` text,
	`user_id` text,
	`user_attributes` text,
	`started_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traces` (
	`trace_id` text PRIMARY KEY,
	`session_id` text,
	`service_name` text,
	`actor_id` text,
	`user_id` text,
	`user_attributes` text,
	`record_count` integer DEFAULT 0 NOT NULL,
	`first_timestamp` text,
	`last_timestamp` text,
	`reconstructed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transmissions` (
	`transmission_id` text PRIMARY KEY,
	`sent_at` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`service_name` text NOT NULL,
	`sdk_name` text NOT NULL,
	`sdk_version` text NOT NULL,
	`platform` text NOT NULL,
	`env` text NOT NULL,
	`record_count` integer NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `verdict_reports` (
	`id` text PRIMARY KEY,
	`scenario_id` text NOT NULL,
	`trace_id` text NOT NULL,
	`qa_session_id` text,
	`overall_verdict` text NOT NULL,
	`report` text NOT NULL,
	`path_observation` text,
	`loop_detected` integer,
	`terminal_reason` text,
	`computed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dlq_pending` ON `dead_letter_queue` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_records_trace_id` ON `event_records` (`trace_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_records_trace_timestamp` ON `event_records` (`trace_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_records_event_key` ON `event_records` (`event_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_records_session_id` ON `event_records` (`qa_session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_insight_labels_kind` ON `insight_labels` (`kind`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_insight_labels_target` ON `insight_labels` (`target_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traces_session_id` ON `traces` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traces_reconstructed` ON `traces` (`reconstructed`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verdict_reports_scenario_id` ON `verdict_reports` (`scenario_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verdict_reports_trace_id` ON `verdict_reports` (`trace_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verdict_reports_session_id` ON `verdict_reports` (`qa_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uniq_verdict_scenario_trace` ON `verdict_reports` (`scenario_id`,`trace_id`);