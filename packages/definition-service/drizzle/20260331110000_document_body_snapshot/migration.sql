ALTER TABLE `documents` ADD `doc_version` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD `revision` integer;
--> statement-breakpoint
ALTER TABLE `documents` ADD `body` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `document_history` ADD `doc_version` text;
--> statement-breakpoint
ALTER TABLE `document_history` ADD `revision` integer;
