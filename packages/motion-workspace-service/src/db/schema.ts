// @def.boundary motion-workspace-service-spec
/**
 * motion-workspace-service Drizzle 스키마 정의
 *
 * 2개 테이블: motion_workspaces, motion_workspace_scenes
 */
import { sqliteTable, text, integer, index, foreignKey, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const motionWorkspaces = sqliteTable(
  "motion_workspaces",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull(),
    globalRevision: integer("global_revision").notNull(),
    savedAt: text("saved_at").notNull(),
    workspaceJson: text("workspace_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index("idx_motion_workspaces_saved_at").on(t.savedAt, t.id),
  ],
);

export const motionWorkspaceScenes = sqliteTable(
  "motion_workspace_scenes",
  {
    workspaceId: text("workspace_id").notNull(),
    sceneId: text("scene_id").notNull(),
    position: integer("position").notNull(),
    revision: integer("revision").notNull(),
    sceneJson: text("scene_json").notNull(),
    savedAt: text("saved_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.sceneId] }),
    index("idx_motion_workspace_scenes_workspace").on(t.workspaceId, t.position),
    foreignKey({
      columns: [t.workspaceId],
      foreignColumns: [motionWorkspaces.id],
    }).onDelete("cascade"),
  ],
);
