CREATE TABLE IF NOT EXISTS `semantic_terms` (
  `term_id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `canonical_label` text NOT NULL,
  `normalized_label` text NOT NULL,
  `coordinate` text,
  `prefix_id` text,
  `version_id` text,
  `address` integer,
  `doc_id` text,
  `source_path` text,
  `evidence_json` text DEFAULT '{}' NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_terms_identity_unique` ON `semantic_terms` (`kind`, `canonical_label`, `coordinate`, `doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_label` ON `semantic_terms` (`normalized_label`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_doc` ON `semantic_terms` (`doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_address` ON `semantic_terms` (`prefix_id`, `version_id`, `address`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_aliases` (
  `alias_id` text PRIMARY KEY NOT NULL,
  `term_id` text NOT NULL,
  `alias` text NOT NULL,
  `normalized_alias` text NOT NULL,
  `locale` text,
  `source` text NOT NULL,
  `confidence` real NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_aliases_term_alias_source_unique` ON `semantic_aliases` (`term_id`, `normalized_alias`, `source`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_aliases_alias` ON `semantic_aliases` (`normalized_alias`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_aliases_term` ON `semantic_aliases` (`term_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_relations` (
  `relation_id` text PRIMARY KEY NOT NULL,
  `source_term_id` text NOT NULL,
  `relation_type` text NOT NULL,
  `target_term_id` text NOT NULL,
  `evidence_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_relations_source` ON `semantic_relations` (`source_term_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_relations_target` ON `semantic_relations` (`target_term_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_grounding_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `query` text NOT NULL,
  `intent` text NOT NULL,
  `candidate_json` text DEFAULT '[]' NOT NULL,
  `plan_json` text DEFAULT '{}' NOT NULL,
  `outcome` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_grounding_events_created` ON `semantic_grounding_events` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_feedback_proposals` (
  `proposal_id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `term` text NOT NULL,
  `normalized_term` text NOT NULL,
  `dedupe_key` text NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `evidence_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_feedback_proposals_dedupe_unique` ON `semantic_feedback_proposals` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_feedback_status_kind` ON `semantic_feedback_proposals` (`status`, `kind`);
