/**
 * definition-service Drizzle ORM 스키마
 *
 * 8개 테이블 (Drizzle 관리):
 *   prefix_registry, documents, document_links, document_history,
 *   slice_intents, consumption_snapshots, test_registry, test_results
 *
 * NOTE: documents_fts (FTS5 virtual table)는 Drizzle에서 지원하지 않으므로
 * 마이그레이션 SQL에서 직접 관리한다.
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── prefix_registry ──────────────────────────────────────────────
export const prefixRegistry = sqliteTable(
  "prefix_registry",
  {
    prefixId: text("prefix_id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    labelsJson: text("labels_json").notNull().default("[]"),
    dimsJson: text("dims_json").notNull().default("{}"),
    versionsJson: text("versions_json").notNull().default("[]"),
    metaJson: text("meta_json").notNull().default("{}"),
    depPrefixIds: text("dep_prefix_ids").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    registeredAt: text("registered_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_pr_category").on(table.category)],
);

// ── documents ────────────────────────────────────────────────────
export const documents = sqliteTable(
  "documents",
  {
    docId: text("doc_id").primaryKey(),
    scope: text("scope").notNull(),
    aspect: text("aspect").notNull(),
    depth: text("depth").notNull(),
    lifecycle: text("lifecycle").notNull(),
    targetPrefix: text("target_prefix"),
    layer: text("layer"),
    tagsJson: text("tags_json").notNull().default("[]"),
    linksJson: text("links_json").notNull().default("[]"),
    svc: text("svc"),
    address: text("address"),
    version: integer("version").notNull().default(1),
    bodyHash: text("body_hash").notNull(),
    purpose: text("purpose"),
    intent: text("intent"),
    context: text("context"),
    caveat: text("caveat"),
    syncedAt: text("synced_at").notNull(),
    sourcePath: text("source_path"),
  },
  (table) => [
    index("idx_doc_scope").on(table.scope, table.aspect),
    index("idx_doc_lifecycle").on(table.lifecycle),
    index("idx_doc_layer").on(table.layer),
    index("idx_doc_svc").on(table.svc),
    index("idx_doc_address").on(table.address),
    index("idx_doc_depth").on(table.depth),
    index("idx_doc_target_prefix").on(table.targetPrefix),
  ],
);

// ── document_links ───────────────────────────────────────────────
export const documentLinks = sqliteTable(
  "document_links",
  {
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    linkType: text("link_type").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.targetId, table.linkType] }),
    index("idx_dl_target").on(table.targetId, table.linkType),
    index("idx_dl_type").on(table.linkType),
  ],
);

// ── document_history ─────────────────────────────────────────────
export const documentHistory = sqliteTable(
  "document_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docId: text("doc_id").notNull(),
    version: integer("version").notNull(),
    scope: text("scope").notNull(),
    aspect: text("aspect").notNull(),
    depth: text("depth").notNull(),
    lifecycle: text("lifecycle").notNull(),
    layer: text("layer"),
    tagsJson: text("tags_json").notNull(),
    linksJson: text("links_json").notNull(),
    bodyHash: text("body_hash").notNull(),
    body: text("body").notNull(),
    purpose: text("purpose"),
    intent: text("intent"),
    context: text("context"),
    caveat: text("caveat"),
    changeType: text("change_type").notNull(),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => [
    uniqueIndex("document_history_doc_id_version_unique").on(
      table.docId,
      table.version,
    ),
    index("idx_dh_doc").on(table.docId, table.version),
  ],
);

// ── slice_intents ────────────────────────────────────────────────
export const sliceIntents = sqliteTable(
  "slice_intents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prefixId: text("prefix_id").notNull(),
    sliceJson: text("slice_json").notNull(),
    sliceDepth: integer("slice_depth").notNull(),
    intent: text("intent").notNull(),
    observationGoal: text("observation_goal"),
    owner: text("owner"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_si_prefix").on(table.prefixId)],
);

// ── consumption_snapshots ────────────────────────────────────────
export const consumptionSnapshots = sqliteTable(
  "consumption_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prefixId: text("prefix_id").notNull(),
    prefixVersion: text("prefix_version").notNull(),
    collectedAt: text("collected_at").notNull(),
    totalSpace: integer("total_space").notNull(),
    observedAddresses: integer("observed_addresses").notNull(),
    consumptionRate: real("consumption_rate").notNull(),
    dimStatsJson: text("dim_stats_json").notNull(),
    severity: text("severity"),
  },
  (table) => [
    index("idx_cs_prefix").on(table.prefixId, table.collectedAt),
  ],
);

// ── test_registry ────────────────────────────────────────────────
export const testRegistry = sqliteTable(
  "test_registry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docId: text("doc_id").notNull(),
    testFile: text("test_file").notNull(),
    suite: text("suite"),
    description: text("description"),
    layer: text("layer"),
    registeredAt: text("registered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("test_registry_doc_id_test_file_suite_unique").on(
      table.docId,
      table.testFile,
      table.suite,
    ),
    index("idx_tr_doc").on(table.docId),
    index("idx_tr_file").on(table.testFile),
  ],
);

// ── test_results ─────────────────────────────────────────────────
export const testResults = sqliteTable(
  "test_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docId: text("doc_id").notNull(),
    testFile: text("test_file").notNull(),
    suite: text("suite"),
    passed: integer("passed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    durationMs: integer("duration_ms"),
    errorSummary: text("error_summary"),
    runAt: text("run_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_tres_doc").on(table.docId, table.runAt)],
);
