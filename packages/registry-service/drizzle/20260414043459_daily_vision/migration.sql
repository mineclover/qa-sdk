CREATE TABLE `ontology_address_allocation` (
	`allocation_id` text PRIMARY KEY,
	`ontology_id` text NOT NULL,
	`taxonomy_id` text NOT NULL,
	`prefix` text NOT NULL,
	`version_id` text NOT NULL,
	`address_model` text DEFAULT 'product' NOT NULL,
	`capacity` integer NOT NULL,
	`address_offset` integer NOT NULL,
	`address_size` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	CONSTRAINT "chk_ontology_address_allocation_address_model" CHECK(address_model IN ('product', 'sum')),
	CONSTRAINT "chk_ontology_address_allocation_status" CHECK(status IN ('reserved', 'active', 'deprecated'))
);
--> statement-breakpoint
CREATE TABLE `ontology_address_segment` (
	`allocation_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`consumes_json` text NOT NULL,
	`address_offset` integer NOT NULL,
	`address_size` integer NOT NULL,
	CONSTRAINT `ontology_address_segment_pk` PRIMARY KEY(`allocation_id`, `segment_id`)
);
--> statement-breakpoint
CREATE TABLE `ontology_axis` (
	`ontology_id` text NOT NULL,
	`axis_id` text NOT NULL,
	`version_id` text NOT NULL,
	`values_json` text NOT NULL,
	`values_hash` text NOT NULL,
	`capacity` integer NOT NULL,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	CONSTRAINT `ontology_axis_pk` PRIMARY KEY(`ontology_id`, `axis_id`, `version_id`),
	CONSTRAINT "chk_ontology_axis_lifecycle" CHECK(lifecycle IN ('draft', 'active', 'deprecated'))
);
--> statement-breakpoint
CREATE TABLE `ontology_namespace` (
	`ontology_id` text PRIMARY KEY,
	`namespace` text NOT NULL,
	`owner` text,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "chk_ontology_namespace_lifecycle" CHECK(lifecycle IN ('draft', 'active', 'deprecated'))
);
--> statement-breakpoint
CREATE TABLE `ontology_taxonomy` (
	`ontology_id` text NOT NULL,
	`taxonomy_id` text NOT NULL,
	`version_id` text NOT NULL,
	`applies_to_json` text NOT NULL,
	`axis_ids_json` text NOT NULL,
	`identity_axis_ids_json` text NOT NULL,
	`space` text,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	CONSTRAINT `ontology_taxonomy_pk` PRIMARY KEY(`ontology_id`, `taxonomy_id`, `version_id`),
	CONSTRAINT "chk_ontology_taxonomy_lifecycle" CHECK(lifecycle IN ('draft', 'active', 'deprecated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ontology_address_allocation_prefix_version` ON `ontology_address_allocation` (`prefix`,`version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ontology_address_allocation_ontology_taxonomy_version` ON `ontology_address_allocation` (`ontology_id`,`taxonomy_id`,`version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ontology_namespace_namespace` ON `ontology_namespace` (`namespace`);
