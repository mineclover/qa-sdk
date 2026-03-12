CREATE TABLE "dead_letter_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"phase" text NOT NULL,
	"error_message" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "event_records" (
	"log_id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"timestamp" timestamp with time zone NOT NULL,
	"record_kind" text NOT NULL,
	"event_key" text NOT NULL,
	"event_version" text NOT NULL,
	"span_name" text,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"status_code" text,
	"payload_format" text NOT NULL,
	"payload_encoding" text NOT NULL,
	"payload_masking_applied" boolean NOT NULL,
	"payload_masked_fields" jsonb NOT NULL,
	"payload" jsonb,
	"registry_warning" text,
	"qa_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"scenario_id" text,
	"labels" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runtime_graphs" (
	"trace_id" text PRIMARY KEY NOT NULL,
	"graph" jsonb NOT NULL,
	"node_count" integer NOT NULL,
	"edge_count" integer NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_specs" (
	"scenario_id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"domain" text NOT NULL,
	"description" text,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traces" (
	"trace_id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"service_name" text,
	"record_count" integer DEFAULT 0 NOT NULL,
	"first_timestamp" timestamp with time zone,
	"last_timestamp" timestamp with time zone,
	"reconstructed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transmissions" (
	"transmission_id" text PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"service_name" text NOT NULL,
	"sdk_name" text NOT NULL,
	"sdk_version" text NOT NULL,
	"platform" text NOT NULL,
	"env" text NOT NULL,
	"record_count" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verdict_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"trace_id" text NOT NULL,
	"qa_session_id" text,
	"overall_verdict" text NOT NULL,
	"report" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verdict_reports_scenario_id_trace_id_unique" UNIQUE("scenario_id","trace_id")
);
--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_trace_id_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_records" ADD CONSTRAINT "event_records_trace_id_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_graphs" ADD CONSTRAINT "runtime_graphs_trace_id_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_session_id_qa_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."qa_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_reports" ADD CONSTRAINT "verdict_reports_trace_id_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dead_letter_queue_pending" ON "dead_letter_queue" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_queue_trace_phase" ON "dead_letter_queue" USING btree ("trace_id","phase");--> statement-breakpoint
CREATE INDEX "idx_event_records_trace_id" ON "event_records" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_event_records_trace_timestamp" ON "event_records" USING btree ("trace_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_event_records_event_key" ON "event_records" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "idx_event_records_session_id" ON "event_records" USING btree ("qa_session_id");--> statement-breakpoint
CREATE INDEX "idx_scenario_specs_domain" ON "scenario_specs" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_traces_session_id" ON "traces" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_traces_reconstructed" ON "traces" USING btree ("reconstructed");--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_scenario_id" ON "verdict_reports" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_trace_id" ON "verdict_reports" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_session_id" ON "verdict_reports" USING btree ("qa_session_id");--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_verdict" ON "verdict_reports" USING btree ("overall_verdict");