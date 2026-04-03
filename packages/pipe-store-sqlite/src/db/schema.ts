/**
 * Meta-Semantic SQLite 스키마
 *
 * 6개 테이블: pipe_graphs, pipe_specs, prefix_versions, service_manifests,
 * data_object_bindings, lineage_validations
 */

import { sqliteTable, text, index, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** PipeGraph 테이블 — graphId+version 복합 유일 */
export const pipeGraphs = sqliteTable(
  "pipe_graphs",
  {
    /** graphId:version 복합 PK */
    id: text("id").notNull().primaryKey(),
    graphId: text("graph_id").notNull(),
    version: text("version").notNull(),
    description: text("description"),
    /** PipeSpec[] JSON */
    pipes: text("pipes").notNull(),
    /** PipeConnection[] JSON */
    connections: text("connections").notNull(),
    entryPipeId: text("entry_pipe_id").notNull(),
    manifestVersion: text("manifest_version"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index("idx_pg_graph_id").on(t.graphId),
    index("idx_pg_version").on(t.graphId, t.version),
  ],
);

/** PipeSpec 테이블 — pipeId+version 복합 유일 */
export const pipeSpecs = sqliteTable(
  "pipe_specs",
  {
    /** pipeId:version 복합 PK */
    id: text("id").notNull().primaryKey(),
    pipeId: text("pipe_id").notNull(),
    version: text("version").notNull(),
    description: text("description"),
    /** trigger JSON { eventKey, entryConditions? } */
    trigger: text("trigger").notNull(),
    /** PipeFlow JSON (29종 union) */
    flow: text("flow").notNull(),
    /** string[] JSON — 생산 이벤트 */
    produces: text("produces"),
    scope: text("scope"),
    aspect: text("aspect"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index("idx_ps_pipe_id").on(t.pipeId),
    index("idx_ps_version").on(t.pipeId, t.version),
  ],
);

/** Prefix 버전 레코드 — prefixId+version 복합 유일 */
export const prefixVersions = sqliteTable(
  "prefix_versions",
  {
    id: text("id").notNull().primaryKey(), // prefixId:version
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    state: text("state").notNull(), // PrefixLifecycleState
    createdAt: text("created_at").notNull(),
    releasedAt: text("released_at"),
    activatedAt: text("activated_at"),
    deprecatedAt: text("deprecated_at"),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("idx_pv_prefix_id").on(t.prefixId),
    uniqueIndex("idx_pv_unique").on(t.prefixId, t.version),
  ],
);

/** 서비스 버전 매니페스트 — serviceId+manifestVersion 복합 유일 */
export const serviceManifests = sqliteTable(
  "service_manifests",
  {
    id: text("id").notNull().primaryKey(), // serviceId:manifestVersion
    serviceId: text("service_id").notNull(),
    manifestVersion: text("manifest_version").notNull(),
    state: text("state").notNull(), // ManifestLifecycleState
    /** Record<string, string> JSON — prefixId → version */
    prefixes: text("prefixes").notNull(),
    createdAt: text("created_at").notNull(),
    publishedAt: text("published_at"),
    activatedAt: text("activated_at"),
    supersededAt: text("superseded_at"),
    archivedAt: text("archived_at"),
    changelog: text("changelog"),
  },
  (t) => [
    index("idx_sm_service_id").on(t.serviceId),
    uniqueIndex("idx_sm_unique").on(t.serviceId, t.manifestVersion),
  ],
);

/** Data object binding snapshot — schemaId 기준 최신 바인딩 */
export const dataObjectBindings = sqliteTable(
  "data_object_bindings",
  {
    schemaId: text("schema_id").notNull().primaryKey(),
    prefixId: text("prefix_id").notNull(),
    prefixVersion: text("prefix_version").notNull(),
    /** Record<string, ColumnAxisMapping> JSON */
    columnToAxis: text("column_to_axis").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index("idx_dob_prefix_id").on(t.prefixId),
    index("idx_dob_prefix_version").on(t.prefixId, t.prefixVersion),
  ],
);

/** Facet-code mapping — 패싯 ↔ 소스 코드 매핑 */
export const facetCodeMappings = sqliteTable(
  "facet_code_mappings",
  {
    facet: text("facet").notNull().primaryKey(),
    /** FacetCodeRef[] JSON */
    implementations: text("implementations").notNull(),
    schemaId: text("schema_id"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index("idx_fcm_schema_id").on(t.schemaId),
  ],
);

/** Lineage validation history — schemaId별 검증 이력 */
export const lineageValidations = sqliteTable(
  "lineage_validations",
  {
    id: text("id").notNull().primaryKey(),
    schemaId: text("schema_id").notNull(),
    validatedAt: text("validated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    bound: integer("bound").notNull(),
    unbound: integer("unbound").notNull(),
    mismatched: integer("mismatched").notNull(),
    /** validation detail payload JSON */
    details: text("details").notNull(),
  },
  (t) => [
    index("idx_lv_schema_id").on(t.schemaId),
    index("idx_lv_schema_validated_at").on(t.schemaId, t.validatedAt),
  ],
);
