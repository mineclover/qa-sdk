import type Database from "better-sqlite3";
import type { DocRecord, DocHistoryRecord } from "../core/types.js";
import type { DocStore, DocMetadataUpdate } from "../core/interfaces.js";
import { decideVersion } from "../core/doc-versioner.js";

/** SQLite row → DocRecord 변환 */
function rowToDoc(row: Record<string, unknown>): DocRecord {
  return {
    docId: row["doc_id"] as string,
    scope: row["scope"] as string,
    aspect: row["aspect"] as string,
    depth: row["depth"] as string,
    lifecycle: row["lifecycle"] as string,
    layer: (row["layer"] as string) || undefined,
    tags: JSON.parse((row["tags_json"] as string) || "[]"),
    links: JSON.parse((row["links_json"] as string) || "[]"),
    svc: (row["svc"] as string) || undefined,
    version: row["version"] as number,
    bodyHash: row["body_hash"] as string,
    purpose: (row["purpose"] as string) || undefined,
    intent: (row["intent"] as string) || undefined,
    context: (row["context"] as string) || undefined,
    caveat: (row["caveat"] as string) || undefined,
    syncedAt: row["synced_at"] as string,
    sourcePath: (row["source_path"] as string) || undefined,
  };
}

/** SQLite row → DocHistoryRecord 변환 */
function rowToHistory(row: Record<string, unknown>): DocHistoryRecord {
  return {
    ...rowToDoc(row),
    body: row["body"] as string,
    changeType: row["change_type"] as DocHistoryRecord["changeType"],
  };
}

/** better-sqlite3 기반 문서 저장소 */
export class SqlDocStore implements DocStore {
  private readonly stmtGet;
  private readonly stmtUpsert;
  private readonly stmtInsertHistory;
  private readonly stmtGetHistory;
  private readonly stmtGetVersion;

  constructor(private readonly db: Database.Database) {
    this.stmtGet = db.prepare(
      `SELECT * FROM documents WHERE doc_id = ?`,
    );
    this.stmtUpsert = db.prepare(`
      INSERT INTO documents (doc_id, scope, aspect, depth, lifecycle, layer, tags_json, links_json, svc, version, body_hash, purpose, intent, context, caveat, synced_at, source_path)
      VALUES (@doc_id, @scope, @aspect, @depth, @lifecycle, @layer, @tags_json, @links_json, @svc, @version, @body_hash, @purpose, @intent, @context, @caveat, @synced_at, @source_path)
      ON CONFLICT(doc_id) DO UPDATE SET
        scope=@scope, aspect=@aspect, depth=@depth, lifecycle=@lifecycle, layer=@layer,
        tags_json=@tags_json, links_json=@links_json, svc=@svc, version=@version,
        body_hash=@body_hash, purpose=@purpose, intent=@intent, context=@context,
        caveat=@caveat, synced_at=@synced_at, source_path=@source_path
    `);
    this.stmtInsertHistory = db.prepare(`
      INSERT INTO document_history (doc_id, version, scope, aspect, depth, lifecycle, layer, tags_json, links_json, body_hash, body, purpose, intent, context, caveat, change_type, synced_at)
      VALUES (@doc_id, @version, @scope, @aspect, @depth, @lifecycle, @layer, @tags_json, @links_json, @body_hash, @body, @purpose, @intent, @context, @caveat, @change_type, @synced_at)
    `);
    this.stmtGetHistory = db.prepare(
      `SELECT * FROM document_history WHERE doc_id = ? ORDER BY version DESC LIMIT ?`,
    );
    this.stmtGetVersion = db.prepare(
      `SELECT * FROM document_history WHERE doc_id = ? AND version = ?`,
    );
  }

  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number } {
    const existing = this.get(doc.docId);
    const decision = decideVersion(existing, doc);

    if (decision.action === "unchanged") {
      return { action: "unchanged", version: decision.version };
    }

    const { version, changeType } = decision;
    const params = {
      doc_id: doc.docId,
      scope: doc.scope,
      aspect: doc.aspect,
      depth: doc.depth,
      lifecycle: doc.lifecycle,
      layer: doc.layer ?? null,
      tags_json: JSON.stringify(doc.tags),
      links_json: JSON.stringify(doc.links),
      svc: doc.svc ?? null,
      version,
      body_hash: doc.bodyHash,
      purpose: doc.purpose ?? null,
      intent: doc.intent ?? null,
      context: doc.context ?? null,
      caveat: doc.caveat ?? null,
      synced_at: doc.syncedAt,
      source_path: doc.sourcePath ?? null,
    };

    this.stmtUpsert.run(params);
    this.stmtInsertHistory.run({
      ...params,
      body,
      change_type: changeType,
    });

    const action = changeType === "created" ? "created" as const : "updated" as const;
    return { action, version };
  }

  updateMetadata(
    docId: string,
    patch: DocMetadataUpdate,
  ): { action: "updated" | "unchanged"; version: number } | null {
    const existing = this.get(docId);
    if (!existing) return null;

    const updated: DocRecord = {
      ...existing,
      scope: patch.scope ?? existing.scope,
      aspect: patch.aspect ?? existing.aspect,
      depth: patch.depth ?? existing.depth,
      lifecycle: patch.lifecycle ?? existing.lifecycle,
      layer: patch.layer === null ? undefined : (patch.layer ?? existing.layer),
      tags: patch.tags ?? existing.tags,
      links: patch.links ?? existing.links,
      svc: patch.svc === null ? undefined : (patch.svc ?? existing.svc),
      syncedAt: new Date().toISOString(),
    };

    // 변경 여부 확인
    const same =
      updated.scope === existing.scope &&
      updated.aspect === existing.aspect &&
      updated.depth === existing.depth &&
      updated.lifecycle === existing.lifecycle &&
      (updated.layer ?? null) === (existing.layer ?? null) &&
      JSON.stringify(updated.tags) === JSON.stringify(existing.tags) &&
      JSON.stringify(updated.links) === JSON.stringify(existing.links) &&
      (updated.svc ?? null) === (existing.svc ?? null);

    if (same) return { action: "unchanged", version: existing.version };

    const version = existing.version + 1;
    const params = {
      doc_id: updated.docId,
      scope: updated.scope,
      aspect: updated.aspect,
      depth: updated.depth,
      lifecycle: updated.lifecycle,
      layer: updated.layer ?? null,
      tags_json: JSON.stringify(updated.tags),
      links_json: JSON.stringify(updated.links),
      svc: updated.svc ?? null,
      version,
      body_hash: updated.bodyHash,
      purpose: updated.purpose ?? null,
      intent: updated.intent ?? null,
      context: updated.context ?? null,
      caveat: updated.caveat ?? null,
      synced_at: updated.syncedAt,
      source_path: updated.sourcePath ?? null,
    };

    this.stmtUpsert.run(params);

    // history: body는 이전 버전에서 가져옴
    const lastHistory = this.stmtGetVersion.get(docId, existing.version) as Record<string, unknown> | undefined;
    const body = (lastHistory?.["body"] as string) ?? "";
    this.stmtInsertHistory.run({
      ...params,
      body,
      change_type: "metadata_edit",
    });

    return { action: "updated", version };
  }

  get(docId: string): DocRecord | null {
    const row = this.stmtGet.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  list(filter?: {
    scope?: string;
    aspect?: string;
    lifecycle?: string;
  }): DocRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.scope) {
      conditions.push("scope = ?");
      params.push(filter.scope);
    }
    if (filter?.aspect) {
      conditions.push("aspect = ?");
      params.push(filter.aspect);
    }
    if (filter?.lifecycle) {
      conditions.push("lifecycle = ?");
      params.push(filter.lifecycle);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const stmt = this.db.prepare(`SELECT * FROM documents ${where} ORDER BY doc_id`);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(rowToDoc);
  }

  getHistory(docId: string, limit = 50): DocHistoryRecord[] {
    const rows = this.stmtGetHistory.all(docId, limit) as Record<string, unknown>[];
    return rows.map(rowToHistory);
  }

  getVersion(docId: string, version: number): DocHistoryRecord | null {
    const row = this.stmtGetVersion.get(docId, version) as Record<string, unknown> | undefined;
    return row ? rowToHistory(row) : null;
  }
}
