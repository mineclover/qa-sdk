ALTER TABLE `flow_instances` RENAME COLUMN `context_json` TO `context`;
--> statement-breakpoint
ALTER TABLE `flow_instances` RENAME COLUMN `selections_json` TO `selections`;
--> statement-breakpoint
ALTER TABLE `flow_instances` RENAME COLUMN `outcome_json` TO `outcome`;
--> statement-breakpoint
ALTER TABLE `flow_schemas` RENAME COLUMN `gates_json` TO `gates`;
--> statement-breakpoint
ALTER TABLE `flow_schemas` RENAME COLUMN `outcomes_json` TO `outcomes`;
--> statement-breakpoint
ALTER TABLE `flow_schemas` RENAME COLUMN `meta_json` TO `meta`;
