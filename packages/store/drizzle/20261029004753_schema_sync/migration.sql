-- schema.ts와 마이그레이션의 누락분 동기화 (swc-next X-18).
-- 0000 이후 schema.ts에만 추가되고 마이그레이션이 없던 테이블 3개·identity 컬럼·address_context,
-- 그리고 metric_* 컬럼을 추가한다. 모두 additive (CREATE TABLE / ADD COLUMN / 인덱스).
-- verdict_reports의 path_observation·loop_detected·terminal_reason은 20260313105000_path_observation이
-- 이미 추가하므로 생성 결과에서 제외했다 (0001은 snapshot 없이 손으로 작성된 마이그레이션).
CREATE TABLE "insight_labels" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_observation_prefixes" (
	"prefix_id" text PRIMARY KEY,
	"distinct_keys" integer DEFAULT 1 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_observations" (
	"packed_key" text PRIMARY KEY,
	"prefix_id" text NOT NULL,
	"registered" boolean DEFAULT false NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"payload_summary" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "address_context" jsonb;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "user_attributes" jsonb;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_type" text;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_name" text;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_value" double precision;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_unit" text;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_labels" jsonb;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_buckets" jsonb;--> statement-breakpoint
ALTER TABLE "event_records" ADD COLUMN "metric_quantiles" jsonb;--> statement-breakpoint
ALTER TABLE "qa_sessions" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "qa_sessions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "qa_sessions" ADD COLUMN "user_attributes" jsonb;--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN "user_attributes" jsonb;--> statement-breakpoint
DROP INDEX "idx_traces_reconstructed";--> statement-breakpoint
CREATE INDEX "idx_traces_reconstructed" ON "traces" ("reconstructed","created_at");--> statement-breakpoint
CREATE INDEX "idx_insight_labels_kind" ON "insight_labels" ("kind");--> statement-breakpoint
CREATE INDEX "idx_insight_labels_target" ON "insight_labels" ("target_id");--> statement-breakpoint
CREATE INDEX "idx_key_obs_prefix" ON "key_observations" ("prefix_id");--> statement-breakpoint
CREATE INDEX "idx_key_obs_last_seen" ON "key_observations" ("last_seen");--> statement-breakpoint
CREATE INDEX "idx_key_obs_count" ON "key_observations" ("count");--> statement-breakpoint
CREATE INDEX "idx_key_obs_registered" ON "key_observations" ("registered");