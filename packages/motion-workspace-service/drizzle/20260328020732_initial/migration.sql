CREATE TABLE IF NOT EXISTS `motion_workspace_scenes` (
	`workspace_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`position` integer NOT NULL,
	`revision` integer NOT NULL,
	`scene_json` text NOT NULL,
	`saved_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `motion_workspace_scenes_pk` PRIMARY KEY(`workspace_id`, `scene_id`),
	CONSTRAINT `fk_motion_workspace_scenes_workspace_id_motion_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `motion_workspaces`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `motion_workspaces` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`global_revision` integer NOT NULL,
	`saved_at` text NOT NULL,
	`workspace_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_motion_workspace_scenes_workspace` ON `motion_workspace_scenes` (`workspace_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_motion_workspaces_saved_at` ON `motion_workspaces` (`saved_at`,`id`);
