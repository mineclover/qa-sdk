// @def.doc definition-service

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

// ── JSON 컬럼 내부 타입 ─────────────────────────────────────────
// parseJsonArray/parseJsonObject 호출 시 제네릭 인자로 사용

/** documents.tagsJson 내부 타입 */
export type DocTagsJson = string[];

/** documents.linksJson 내부 타입 */
export type DocLinkJson = { target: string; type: string };

/** prefix_registry.labelsJson 내부 타입 */
export type PrefixLabelsJson = string[];

/** prefix_registry.dimsJson 내부 타입 */
export type PrefixDimsJson = Record<
  string,
  { kind: string; axisId?: string; prefixId?: string; table?: string }
>;

/** prefix_registry.versionsJson 내부 타입 */
export type PrefixVersionJson = {
  version: string;
  axisVersions: Record<string, string>;
};

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
    labelsJson: text("labels_json", { mode: "json" }).$type<PrefixLabelsJson>().notNull().default([]),
    dimsJson: text("dims_json", { mode: "json" }).$type<PrefixDimsJson>().notNull().default({}),
    versionsJson: text("versions_json", { mode: "json" }).$type<PrefixVersionJson[]>().notNull().default([]),
    metaJson: text("meta_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    depPrefixIds: text("dep_prefix_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
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
    title: text("title"),
    /** spec | knowledge */
    docType: text("doc_type"),
    /** philosophy | adr | guide | narrative | convention | pattern (knowledge 문서만) */
    knowledgeKind: text("knowledge_kind"),
    /** group | module | leaf */
    level: text("level"),
    scope: text("scope").notNull(),
    aspect: text("aspect").notNull(),
    depth: text("depth").notNull(),
    lifecycle: text("lifecycle").notNull(),
    targetPrefix: text("target_prefix"),
    layer: text("layer"),
    tagsJson: text("tags_json", { mode: "json" }).$type<DocTagsJson>().notNull().default([]),
    linksJson: text("links_json", { mode: "json" }).$type<DocLinkJson[]>().notNull().default([]),
    svc: text("svc"),
    docVersion: text("doc_version"),
    revision: integer("revision"),
    address: text("address"),
    version: integer("version").notNull().default(1),
    bodyHash: text("body_hash").notNull(),
    body: text("body").notNull().default(""),
    purpose: text("purpose"),
    intent: text("intent"),
    context: text("context"),
    caveat: text("caveat"),
    gateJson: text("gate_json"),
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
    index("idx_doc_type").on(table.docType),
    index("idx_doc_knowledge_kind").on(table.knowledgeKind),
    index("idx_doc_level").on(table.level),
  ],
);

export type PrefixRegistryRow = typeof prefixRegistry.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;

// ── document_links ───────────────────────────────────────────────
export const documentLinks = sqliteTable(
  "document_links",
  {
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    sourceAddress: text("source_address"),
    targetAddress: text("target_address"),
    linkType: text("link_type").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.targetId, table.linkType] }),
    index("idx_dl_target").on(table.targetId, table.linkType),
    index("idx_dl_source_address").on(table.sourceAddress),
    index("idx_dl_target_address").on(table.targetAddress),
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
    title: text("title"),
    docType: text("doc_type"),
    knowledgeKind: text("knowledge_kind"),
    level: text("level"),
    scope: text("scope").notNull(),
    aspect: text("aspect").notNull(),
    depth: text("depth").notNull(),
    lifecycle: text("lifecycle").notNull(),
    layer: text("layer"),
    tagsJson: text("tags_json", { mode: "json" }).$type<DocTagsJson>().notNull(),
    linksJson: text("links_json", { mode: "json" }).$type<DocLinkJson[]>().notNull(),
    docVersion: text("doc_version"),
    revision: integer("revision"),
    bodyHash: text("body_hash").notNull(),
    body: text("body").notNull(),
    purpose: text("purpose"),
    intent: text("intent"),
    context: text("context"),
    caveat: text("caveat"),
    gateJson: text("gate_json"),
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

export type DocumentHistoryRow = typeof documentHistory.$inferSelect;
export type DocumentLinkRow = typeof documentLinks.$inferSelect;

// ── code_references ──────────────────────────────────────────────
export const codeReferences = sqliteTable(
  "code_references",
  {
    codePath: text("code_path").notNull(),
    docId: text("doc_id").notNull(),
    relationType: text("relation_type").notNull(),
    sourceKind: text("source_kind").notNull(),
    symbol: text("symbol").notNull().default(""),
    line: integer("line"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.codePath,
        table.docId,
        table.relationType,
        table.sourceKind,
        table.symbol,
      ],
    }),
    index("idx_cr_code_path").on(table.codePath),
    index("idx_cr_code_path_symbol").on(table.codePath, table.symbol),
    index("idx_cr_doc_id").on(table.docId),
  ],
);

export type CodeReferenceRow = typeof codeReferences.$inferSelect;

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

// ── semantic_grounding ──────────────────────────────────────────
export const semanticTerms = sqliteTable(
  "semantic_terms",
  {
    termId: text("term_id").primaryKey(),
    kind: text("kind").notNull(),
    canonicalLabel: text("canonical_label").notNull(),
    normalizedLabel: text("normalized_label").notNull(),
    coordinate: text("coordinate"),
    prefixId: text("prefix_id"),
    versionId: text("version_id"),
    address: integer("address"),
    docId: text("doc_id"),
    sourcePath: text("source_path"),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_terms_identity_unique").on(
      table.kind,
      table.canonicalLabel,
      table.coordinate,
      table.docId,
    ),
    index("idx_semantic_terms_label").on(table.normalizedLabel),
    index("idx_semantic_terms_doc").on(table.docId),
    index("idx_semantic_terms_address").on(table.prefixId, table.versionId, table.address),
  ],
);

export const semanticAliases = sqliteTable(
  "semantic_aliases",
  {
    aliasId: text("alias_id").primaryKey(),
    termId: text("term_id").notNull(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    locale: text("locale"),
    source: text("source").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_aliases_term_alias_source_unique").on(table.termId, table.normalizedAlias, table.source),
    index("idx_semantic_aliases_alias").on(table.normalizedAlias),
    index("idx_semantic_aliases_term").on(table.termId),
  ],
);

export const semanticRelations = sqliteTable(
  "semantic_relations",
  {
    relationId: text("relation_id").primaryKey(),
    sourceTermId: text("source_term_id").notNull(),
    relationType: text("relation_type").notNull(),
    targetTermId: text("target_term_id").notNull(),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("idx_semantic_relations_source").on(table.sourceTermId),
    index("idx_semantic_relations_target").on(table.targetTermId),
  ],
);

export const semanticGroundingEvents = sqliteTable(
  "semantic_grounding_events",
  {
    eventId: text("event_id").primaryKey(),
    query: text("query").notNull(),
    intent: text("intent").notNull(),
    candidateJson: text("candidate_json", { mode: "json" }).$type<unknown[]>().notNull().default([]),
    planJson: text("plan_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    outcome: text("outcome").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_semantic_grounding_events_created").on(table.createdAt)],
);

export const semanticFeedbackProposals = sqliteTable(
  "semantic_feedback_proposals",
  {
    proposalId: text("proposal_id").primaryKey(),
    kind: text("kind").notNull(),
    term: text("term").notNull(),
    normalizedTerm: text("normalized_term").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_feedback_proposals_dedupe_unique").on(table.dedupeKey),
    index("idx_semantic_feedback_status_kind").on(table.status, table.kind),
  ],
);

export type SemanticTermRow = typeof semanticTerms.$inferSelect;
export type SemanticAliasRow = typeof semanticAliases.$inferSelect;
export type SemanticRelationRow = typeof semanticRelations.$inferSelect;
export type SemanticFeedbackProposalRow = typeof semanticFeedbackProposals.$inferSelect;

// ── aspect_parents ───────────────────────────────────────────────
// Phase C-0 (aspect-schema-hierarchy RFC): Aspect 계층 구조 metadata.
// Source of truth: definition-catalog/src/vocabulary.ts §ASPECT_PARENTS (build-time).
// 본 테이블은 파생 복제본 — registry-service / 외부 도구 접근용.
//
// Populate 는 sync/aspect-parents-sync.ts 의 syncAspectParents() 가 담당.
// Validator 경로는 core/aspect-registry.ts 의 getAspectParent() 가 담당 (DB 우선 → runtime map fallback).
export const aspectParents = sqliteTable(
  "aspect_parents",
  {
    childId: text("child_id").primaryKey(),
    parentId: text("parent_id").notNull(),
    description: text("description"),
    registeredAt: text("registered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_ap_parent").on(table.parentId)],
);

export type AspectParentRow = typeof aspectParents.$inferSelect;
