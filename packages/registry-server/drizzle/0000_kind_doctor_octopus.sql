CREATE TABLE "service_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"event_key" text NOT NULL,
	"event_version" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"record_kind" text DEFAULT 'log' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_service_event_version" UNIQUE("service_id","event_key","event_version"),
	CONSTRAINT "service_events_event_key_format" CHECK ("service_events"."event_key" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "service_events_event_version_format" CHECK ("service_events"."event_version" ~ '^\d+\.\d+\.\d+$'),
	CONSTRAINT "service_events_record_kind_check" CHECK ("service_events"."record_kind" in ('log', 'span', 'both')),
	CONSTRAINT "service_events_status_check" CHECK ("service_events"."status" in ('active', 'deprecated', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "services" (
	"service_id" text PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_service_name_unique" UNIQUE("service_name"),
	CONSTRAINT "services_service_name_format" CHECK ("services"."service_name" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "services_status_check" CHECK ("services"."status" in ('active', 'deprecated', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_service_id_services_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("service_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_events_service_id" ON "service_events" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_service_events_lookup" ON "service_events" USING btree ("service_id","event_key","event_version");