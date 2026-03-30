import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import {
  extractByMarker,
  extractFrontmatter,
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
  dbPath: string;
}

const DEFAULT_DB_PATH = "data/definition-service.sqlite";

const documents = sqliteTable("documents", {
  docId: text("doc_id").primaryKey(),
  title: text("title"),
  docType: text("doc_type"),
  knowledgeKind: text("knowledge_kind"),
  level: text("level"),
  scope: text("scope").notNull(),
  aspect: text("aspect").notNull(),
  depth: text("depth").notNull(),
  lifecycle: text("lifecycle").notNull(),
  targetPrefix: text("target_prefix"),
  layer: text("layer"),
  tagsJson: text("tags_json").notNull(),
  linksJson: text("links_json").notNull(),
  svc: text("svc"),
  address: text("address"),
  version: integer("version").notNull(),
  bodyHash: text("body_hash").notNull(),
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
    linkType: text("link_type").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.sourceId, table.targetId, table.linkType],
    }),
  }),
);

type DrizzleDb = ReturnType<typeof drizzle>;

export async function syncDocsToLocalDb(
  options: SyncLocalDbOptions,
): Promise<SyncLocalDbResult> {
  const rootDir = options.rootDir;
  const docsDir = options.docsDir ?? "docs";
  const dbPath = resolve(rootDir, options.dbPath ?? DEFAULT_DB_PATH);
  const scan = await scanAndBuild(rootDir, [join(rootDir, docsDir)]);

  const sqlite = new Database(dbPath);
  const db = drizzle({
    client: sqlite,
    schema: { documents, documentLinks },
  });

  try {
    resetTables(sqlite);

    const entries = scan.registry.all();
    let linkCount = 0;

    db.transaction((tx) => {
      for (const entry of entries) {
        const sourcePath = entry.ref ? join(rootDir, entry.ref) : null;
        const body = sourcePath ? extractMarkdownBody(sourcePath) : "";
        const outgoing = scan.registry.getLinks(entry.id, "outgoing")
          .map((link) => ({ target: link.targetId, type: link.linkType }));
        const row = toDocumentRow(rootDir, entry, body, outgoing);

        tx.insert(documents).values(row).run();
        tx.run(sql.raw(
          `INSERT INTO documents_fts (doc_id, purpose, intent, context, caveat)
           VALUES (${quote(row.docId)}, ${quote(row.purpose ?? "")}, ${quote(row.intent ?? "")}, ${quote(row.context ?? "")}, ${quote(row.caveat ?? "")})`,
        ));

        if (outgoing.length > 0) {
          tx.insert(documentLinks).values(
            outgoing.map((link) => ({
              sourceId: entry.id,
              targetId: link.target,
              linkType: link.type,
            })),
          ).run();
          linkCount += outgoing.length;
        }
      }
    });

    return {
      synced: entries.length,
      links: linkCount,
      dbPath,
    };
  } finally {
    sqlite.close();
  }
}

function resetTables(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS document_links;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS documents_fts;
    CREATE TABLE IF NOT EXISTS documents (
      doc_id TEXT PRIMARY KEY,
      title TEXT,
      doc_type TEXT,
      knowledge_kind TEXT,
      level TEXT,
      scope TEXT NOT NULL,
      aspect TEXT NOT NULL,
      depth TEXT NOT NULL,
      lifecycle TEXT NOT NULL,
      target_prefix TEXT,
      layer TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      links_json TEXT NOT NULL DEFAULT '[]',
      svc TEXT,
      address TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      body_hash TEXT NOT NULL,
      purpose TEXT,
      intent TEXT,
      context TEXT,
      caveat TEXT,
      gate_json TEXT,
      synced_at TEXT NOT NULL,
      source_path TEXT
    );
    CREATE TABLE IF NOT EXISTS document_links (
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      PRIMARY KEY (source_id, target_id, link_type)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      doc_id UNINDEXED,
      purpose,
      intent,
      context,
      caveat
    );
  `);
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
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    targetPrefix:
      entry.aspect === "prefix_schema" && entry.id.startsWith("prefix-")
        ? entry.id.slice("prefix-".length)
        : null,
    layer: entry.layer ?? null,
    tagsJson: JSON.stringify(entry.tags ?? []),
    linksJson: JSON.stringify(outgoing),
    svc: entry.serviceId ?? null,
    address: entry.serialized ?? null,
    version: entry.revision ?? 1,
    bodyHash: hashBody(body),
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
