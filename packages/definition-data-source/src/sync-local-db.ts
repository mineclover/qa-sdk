// @def.doc definition-data-source

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import {
  ASPECT_PARENTS,
  DEFINITION_TAXONOMY,
  collectCodeReferences,
  extractByMarker,
  extractFrontmatter,
  parseDocument,
  scanAndBuild,
  type DefinitionEntry,
} from "definition-catalog";

export interface SyncLocalDbOptions {
  rootDir: string;
  docsDir?: string;
  dbPath?: string;
}

export interface SyncLocalDbResult {
  synced: number;
  links: number;
  codeReferences: number;
  dbPath: string;
}

const DEFAULT_DB_PATH = "data/definition-service.sqlite";

// ─── Drizzle 스키마 정의 (SSOT) ──────────────────────────

const documents = sqliteTable("documents", {
  docId: text("doc_id").primaryKey(),
  title: text("title"),
  docType: text("doc_type"),
  knowledgeKind: text("knowledge_kind"),
  level: text("level"),
  tier: text("tier"),
  scope: text("scope"),
  aspect: text("aspect"),
  depth: text("depth"),
  lifecycle: text("lifecycle").notNull(),
  targetPrefix: text("target_prefix"),
  layer: text("layer"),
  ownerSystem: text("owner_system"),
  projectionPlane: text("projection_plane"),
  intentHierarchy: text("intent_hierarchy"),
  lineageFacet: text("lineage_facet"),
  lineageKind: text("lineage_kind"),
  tagsJson: text("tags_json").notNull(),
  linksJson: text("links_json").notNull(),
  svc: text("svc"),
  docVersion: text("doc_version"),
  revision: integer("revision"),
  address: text("address"),
  version: integer("version").notNull(),
  bodyHash: text("body_hash").notNull(),
  body: text("body").notNull(),
  purpose: text("purpose"),
  intent: text("intent"),
  context: text("context"),
  caveat: text("caveat"),
  gateJson: text("gate_json"),
  syncedAt: text("synced_at").notNull(),
  sourcePath: text("source_path"),
});

const documentLinks = sqliteTable(
  "document_links",
  {
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    sourceAddress: text("source_address"),
    targetAddress: text("target_address"),
    linkType: text("link_type").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.sourceId, table.targetId, table.linkType],
    }),
  }),
);

const codeReferences = sqliteTable(
  "code_references",
  {
    codePath: text("code_path").notNull(),
    docId: text("doc_id").notNull(),
    relationType: text("relation_type").notNull(),
    sourceKind: text("source_kind").notNull(),
    symbol: text("symbol").notNull(),
    line: integer("line"),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.codePath,
        table.docId,
        table.relationType,
        table.sourceKind,
        table.symbol,
      ],
    }),
  }),
);

// Phase C-0 (aspect-schema-hierarchy RFC): aspect 계층 metadata.
// Source of truth: definition-catalog/src/vocabulary.ts §ASPECT_PARENTS (build-time).
// 본 테이블은 파생 복제본 — CLI 로컬 DB 에서도 외부 도구 접근을 위해 유지.
const aspectParents = sqliteTable("aspect_parents", {
  childId: text("child_id").primaryKey(),
  parentId: text("parent_id").notNull(),
  description: text("description"),
  registeredAt: text("registered_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── 동기화 로직 ──────────────────────────────────────────

export async function syncDocsToLocalDb(
  options: SyncLocalDbOptions,
): Promise<SyncLocalDbResult> {
  const rootDir = options.rootDir;
  const docsDir = options.docsDir ?? "docs";
  const dbPath = resolve(rootDir, options.dbPath ?? DEFAULT_DB_PATH);
  // CI/clean 환경에서 부모 디렉토리가 없으면 better-sqlite3 가 directory 미존재로 fail.
  mkdirSync(dirname(dbPath), { recursive: true });

  // 1. 문서 스캔
  const scan = await scanAndBuild(rootDir, [join(rootDir, docsDir)]);

  const sqlite = new Database(dbPath);
  const db = drizzle({
    client: sqlite,
    schema: { documents, documentLinks, codeReferences, aspectParents },
  });

  try {
    // 2. 테이블 초기화 (Drizzle 스키마 기준)
    resetTables(sqlite);

    const entries = scan.registry.all();
    let linkCount = 0;

    // 3. 일괄 재적재 (단일 트랜잭션)
    db.transaction((tx) => {
      const addressById = new Map(entries.map((entry) => [entry.id, entry.serialized ?? null] as const));
      
      for (const entry of entries) {
        const sourcePath = entry.ref ? join(rootDir, entry.ref) : null;
        const body = sourcePath ? extractMarkdownBody(sourcePath) : "";
        const declared = sourcePath
          ? parseDocument(readFileSync(sourcePath, "utf8"), sourcePath).def.links
          : undefined;
        const links = declared ? declared.map((link) => ({ target: link.target, type: link.type })) : [];
        const row = toDocumentRow(rootDir, entry, body, links);

        tx.insert(documents).values(row).run();
        
        // FTS 가상 테이블 인덱싱
        tx.run(sql.raw(
          `INSERT INTO documents_fts (doc_id, purpose, intent, context, caveat)
           VALUES (${quote(row.docId)}, ${quote(row.purpose ?? "")}, ${quote(row.intent ?? "")}, ${quote(row.context ?? "")}, ${quote(row.caveat ?? "")})`,
        ));

        if (links.length > 0) {
          tx.insert(documentLinks).values(
            links.map((link) => ({
              sourceId: entry.id,
              targetId: link.target,
              sourceAddress: entry.serialized ?? null,
              targetAddress: addressById.get(link.target) ?? null,
              linkType: link.type,
            })),
          ).run();
          linkCount += links.length;
        }
      }

      // 4. 코드 참조 일괄 수집 및 적재
      const refs = collectCodeReferences(rootDir, { docsDir });
      if (refs.length > 0) {
        tx.insert(codeReferences).values(
          refs.map((ref) => ({
            codePath: ref.codePath,
            docId: ref.docId,
            relationType: ref.relationType,
            sourceKind: ref.sourceKind,
            symbol: ref.symbol ?? "", // NOT NULL 제약 준수
            line: ref.line,
          })),
        ).run();
      }

      // 5. aspect_parents 동기화 (Phase C-0 populate + C-1 insert-on-discovery).
      // Source of truth: ASPECT_PARENTS map. resetTables 후 테이블은 비어있으므로 전량 INSERT.
      const descriptionByAspect = buildAspectDescriptionMap();
      const aspectRows = Object.entries(ASPECT_PARENTS).map(([childId, parentId]) => ({
        childId,
        parentId,
        description: descriptionByAspect.get(childId) ?? null,
      }));
      if (aspectRows.length > 0) {
        tx.insert(aspectParents).values(aspectRows).run();
      }
    });

    const codeReferenceCount = db.select().from(codeReferences).all().length;

    return {
      synced: entries.length,
      links: linkCount,
      codeReferences: codeReferenceCount,
      dbPath,
    };
  } finally {
    sqlite.close();
  }
}

function resetTables(sqlite: Database.Database): void {
  sqlite.exec(`
    DROP TABLE IF EXISTS documents_fts;
    DROP TABLE IF EXISTS code_references;
    DROP TABLE IF EXISTS document_links;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS aspect_parents;

    CREATE TABLE documents (
      doc_id TEXT PRIMARY KEY,
      title TEXT,
      doc_type TEXT,
      knowledge_kind TEXT,
      level TEXT,
      tier TEXT,
      scope TEXT,
      aspect TEXT,
      depth TEXT,
      lifecycle TEXT NOT NULL,
      target_prefix TEXT,
      layer TEXT,
      owner_system TEXT,
      projection_plane TEXT,
      intent_hierarchy TEXT,
      lineage_facet TEXT,
      lineage_kind TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      links_json TEXT NOT NULL DEFAULT '[]',
      svc TEXT,
      doc_version TEXT,
      revision INTEGER,
      address TEXT,
      version INTEGER NOT NULL,
      body_hash TEXT NOT NULL,
      body TEXT NOT NULL,
      purpose TEXT,
      intent TEXT,
      context TEXT,
      caveat TEXT,
      gate_json TEXT,
      synced_at TEXT NOT NULL,
      source_path TEXT
    );

    CREATE TABLE document_links (
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      source_address TEXT,
      target_address TEXT,
      link_type TEXT NOT NULL,
      PRIMARY KEY (source_id, target_id, link_type)
    );

    CREATE TABLE code_references (
      code_path TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      symbol TEXT NOT NULL,
      line INTEGER,
      PRIMARY KEY (code_path, doc_id, relation_type, source_kind, symbol)
    );

    CREATE VIRTUAL TABLE documents_fts USING fts5(
      doc_id,
      purpose,
      intent,
      context,
      caveat
    );

    CREATE TABLE aspect_parents (
      child_id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      description TEXT,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_ap_parent ON aspect_parents (parent_id);
  `);
}

/** DEFINITION_TAXONOMY 를 평탄화해 aspect id → description 매핑. */
function buildAspectDescriptionMap(): Map<string, string> {
  const result = new Map<string, string>();
  for (const scope of DEFINITION_TAXONOMY.scopes) {
    for (const aspect of scope.aspects) {
      result.set(aspect.id, aspect.description);
    }
  }
  return result;
}

function extractMarkdownBody(filePath: string): string {
  const content = readFileSync(filePath, "utf8");
  const parsed = extractFrontmatter(content);
  return parsed?.body ?? content;
}

function toDocumentRow(
  rootDir: string,
  entry: DefinitionEntry,
  body: string,
  outgoing: Array<{ target: string; type: string }>,
) {
  const sourcePath = entry.ref ? relative(rootDir, join(rootDir, entry.ref)) : null;

  return {
    docId: entry.id,
    title: entry.title,
    docType: entry.type ?? null,
    knowledgeKind: entry.knowledgeKind ?? null,
    level: entry.level ?? null,
    tier: entry.tier ?? null,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    targetPrefix:
      entry.aspect === "prefix_schema" && entry.id.startsWith("prefix-")
        ? entry.id.slice("prefix-".length)
        : null,
    layer: entry.layer ?? null,
    ownerSystem: entry.owner_system ?? null,
    projectionPlane: entry.projection_plane ?? null,
    intentHierarchy: entry.intent_hierarchy ?? null,
    lineageFacet: entry.lineage_facet ?? null,
    lineageKind: entry.lineage_kind ?? null,
    tagsJson: JSON.stringify(entry.tags ?? []),
    linksJson: JSON.stringify(outgoing),
    svc: entry.serviceId ?? null,
    docVersion: entry.version ?? null,
    revision: entry.revision ?? null,
    address: entry.serialized ?? null,
    version: entry.revision ?? 1,
    bodyHash: hashBody(body),
    body,
    purpose: extractByMarker(body, "purpose").text || null,
    intent: extractByMarker(body, "intent").text || null,
    context: extractByMarker(body, "context").text || null,
    caveat: extractByMarker(body, "caveat").text || null,
    gateJson: entry.gate ? JSON.stringify(entry.gate) : null,
    syncedAt: new Date().toISOString(),
    sourcePath,
  };
}

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
