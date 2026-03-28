import type Database from "better-sqlite3";
import type { DocRecord, DocHistoryRecord } from "../core/types.js";
import type { DocStore, DocMetadataUpdate, DocListFilter } from "../core/interfaces.js";
import { decideVersion } from "../core/doc-versioner.js";
import { computeDocumentAddress } from "../core/compute-address.js";

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
    address: (row["address"] as string) || undefined,
    targetPrefix: (row["target_prefix"] as string) || undefined,
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
  private readonly stmtDeleteLinks;
  private readonly stmtInsertLink;

  constructor(private readonly db: Database.Database) {
    this.stmtGet = db.prepare(
      `SELECT * FROM documents WHERE doc_id = ?`,
    );
    this.stmtDeleteLinks = db.prepare(`DELETE FROM document_links WHERE source_id = ?`);
    this.stmtInsertLink = db.prepare(
      `INSERT OR IGNORE INTO document_links (source_id, target_id, link_type) VALUES (?, ?, ?)`,
    );
    this.stmtUpsert = db.prepare(`
      INSERT INTO documents (doc_id, scope, aspect, depth, lifecycle, layer, tags_json, links_json, svc, address, target_prefix, version, body_hash, purpose, intent, context, caveat, synced_at, source_path)
      VALUES (@doc_id, @scope, @aspect, @depth, @lifecycle, @layer, @tags_json, @links_json, @svc, @address, @target_prefix, @version, @body_hash, @purpose, @intent, @context, @caveat, @synced_at, @source_path)
      ON CONFLICT(doc_id) DO UPDATE SET
        scope=@scope, aspect=@aspect, depth=@depth, lifecycle=@lifecycle, layer=@layer,
        tags_json=@tags_json, links_json=@links_json, svc=@svc, address=@address, target_prefix=@target_prefix, version=@version,
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
    const address = computeDocumentAddress(doc.scope, doc.aspect, doc.depth);
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
      address: address ?? doc.address ?? null,
      target_prefix: doc.targetPrefix ?? null,
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

    this.syncLinks(doc.docId, doc.links);

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
    const address = computeDocumentAddress(updated.scope, updated.aspect, updated.depth);
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
      address: address ?? updated.address ?? null,
      target_prefix: updated.targetPrefix ?? null,
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

    this.syncLinks(docId, updated.links);

    return { action: "updated", version };
  }

  // ── Edge + FTS 동기화 ──────────────────────────────────

  private syncLinks(docId: string, links: { target: string; type: string }[]) {
    this.stmtDeleteLinks.run(docId);
    for (const link of links) {
      this.stmtInsertLink.run(docId, link.target, link.type);
    }
  }

  // ── Link 쿼리 ──────────────────────────────────────────

  /** 특정 문서에서 나가는 링크 */
  getOutgoingLinks(docId: string): { target: string; type: string }[] {
    const stmt = this.db.prepare(`SELECT target_id, link_type FROM document_links WHERE source_id = ?`);
    return (stmt.all(docId) as { target_id: string; link_type: string }[])
      .map(r => ({ target: r.target_id, type: r.link_type }));
  }

  /** 특정 문서로 들어오는 링크 */
  getIncomingLinks(docId: string): { source: string; type: string }[] {
    const stmt = this.db.prepare(`SELECT source_id, link_type FROM document_links WHERE target_id = ?`);
    return (stmt.all(docId) as { source_id: string; link_type: string }[])
      .map(r => ({ source: r.source_id, type: r.link_type }));
  }

  /** contains 링크로 연결된 자식 문서 */
  getChildren(docId: string): DocRecord[] {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.target_id = d.doc_id
      WHERE dl.source_id = ? AND dl.link_type = 'contains'
      ORDER BY d.doc_id
    `);
    return (stmt.all(docId) as Record<string, unknown>[]).map(rowToDoc);
  }

  /** contains 링크로 연결된 부모 문서 */
  getParent(docId: string): DocRecord | null {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.source_id = d.doc_id
      WHERE dl.target_id = ? AND dl.link_type = 'contains'
      LIMIT 1
    `);
    const row = stmt.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  get(docId: string): DocRecord | null {
    const row = this.stmtGet.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  list(filter?: DocListFilter): DocRecord[] {
    const { where, params } = this.buildWhereClause(filter);
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;
    const orderBy = this.resolveOrderBy(filter?.sort);
    const stmt = this.db.prepare(`SELECT * FROM documents ${where} ${orderBy} LIMIT ? OFFSET ?`);
    const rows = stmt.all(...params, limit, offset) as Record<string, unknown>[];
    return rows.map(rowToDoc);
  }

  /** 필터 조건에 매칭되는 전체 건수 (pagination용) */
  count(filter?: DocListFilter): number {
    const { where, params } = this.buildWhereClause(filter);
    const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM documents ${where}`);
    const row = stmt.get(...params) as { cnt: number };
    return row.cnt;
  }

  private buildWhereClause(filter?: DocListFilter): { where: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.scope) { conditions.push("scope = ?"); params.push(filter.scope); }
    if (filter?.aspect) { conditions.push("aspect = ?"); params.push(filter.aspect); }
    if (filter?.depth) { conditions.push("depth = ?"); params.push(filter.depth); }
    if (filter?.lifecycle) { conditions.push("lifecycle = ?"); params.push(filter.lifecycle); }
    if (filter?.layer) { conditions.push("layer = ?"); params.push(filter.layer); }
    if (filter?.svc) { conditions.push("svc = ?"); params.push(filter.svc); }
    if (filter?.address) { conditions.push("address = ?"); params.push(filter.address); }
    if (filter?.tag) {
      conditions.push("tags_json LIKE ?");
      params.push(`%"${filter.tag}"%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, params };
  }

  private resolveOrderBy(sort?: string): string {
    switch (sort) {
      case "synced_at": return "ORDER BY synced_at ASC";
      case "synced_at_desc": return "ORDER BY synced_at DESC";
      default: return "ORDER BY doc_id";
    }
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
