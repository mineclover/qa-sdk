ALTER TABLE `documents` ADD COLUMN `title` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `level` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `gate_json` text;
--> statement-breakpoint
ALTER TABLE `document_history` ADD COLUMN `title` text;
--> statement-breakpoint
ALTER TABLE `document_history` ADD COLUMN `level` text;
--> statement-breakpoint
ALTER TABLE `document_history` ADD COLUMN `gate_json` text;
