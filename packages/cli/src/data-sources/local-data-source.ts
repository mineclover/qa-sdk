/**
 * LocalDataSource — SQLite 직접 접근으로 definition 데이터 조회
 *
 * definition-service.sqlite를 읽기 전용으로 열어
 * DefDataSource 인터페이스를 구현한다. 서버 기동 불필요.
 */

import Database from "better-sqlite3";
import type {
  DefDataSource,
  DefDoc,
  DefIncomingLink,
  DefListFilter,
  DefValidationResult,
} from "definition-catalog";

function rowToDoc(row: Record<string, unknown>): DefDoc {
  return {
    docId: row["doc_id"] as string,
    level: (row["level"] as string) || undefined,
    scope: row["scope"] as string,
    aspect: row["aspect"] as string,
    depth: row["depth"] as string,
    lifecycle: row["lifecycle"] as string,
    layer: (row["layer"] as string) || undefined,
    tags: JSON.parse((row["tags_json"] as string) || "[]"),
    links: JSON.parse((row["links_json"] as string) || "[]"),
    svc: (row["svc"] as string) || undefined,
    address: (row["address"] as string) || undefined,
    version: row["version"] as number,
    purpose: (row["purpose"] as string) || undefined,
    intent: (row["intent"] as string) || undefined,
    context: (row["context"] as string) || undefined,
    caveat: (row["caveat"] as string) || undefined,
    sourcePath: (row["source_path"] as string) || undefined,
  };
}

export class LocalDataSource implements DefDataSource {
  readonly mode = "local" as const;
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
  }

  async get(docId: string): Promise<DefDoc | null> {
    const row = this.db.prepare("SELECT * FROM documents WHERE doc_id = ?").get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  async list(filter?: DefListFilter): Promise<DefDoc[]> {
    // 전문 검색
    if (filter?.q) {
      const stmt = this.db.prepare(`
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ?
        LIMIT ?
      `);
      return (stmt.all(filter.q, filter?.limit ?? 50) as Record<string, unknown>[]).map(rowToDoc);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.scope) { conditions.push("scope = ?"); params.push(filter.scope); }
    if (filter?.aspect) { conditions.push("aspect = ?"); params.push(filter.aspect); }
    if (filter?.depth) { conditions.push("depth = ?"); params.push(filter.depth); }
    if (filter?.lifecycle) { conditions.push("lifecycle = ?"); params.push(filter.lifecycle); }
    if (filter?.layer) { conditions.push("layer = ?"); params.push(filter.layer); }
    if (filter?.level) { conditions.push("level = ?"); params.push(filter.level); }
    if (filter?.svc) { conditions.push("svc = ?"); params.push(filter.svc); }
    if (filter?.address) { conditions.push("address = ?"); params.push(filter.address); }
    if (filter?.tag) { conditions.push("tags_json LIKE ?"); params.push(`%"${filter.tag}"%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;
    const stmt = this.db.prepare(`SELECT * FROM documents ${where} ORDER BY doc_id LIMIT ? OFFSET ?`);
    return (stmt.all(...params, limit, offset) as Record<string, unknown>[]).map(rowToDoc);
  }

  async getChildren(docId: string): Promise<DefDoc[]> {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.target_id = d.doc_id
      WHERE dl.source_id = ? AND dl.link_type = 'contains'
      ORDER BY d.doc_id
    `);
    return (stmt.all(docId) as Record<string, unknown>[]).map(rowToDoc);
  }

  async getParent(docId: string): Promise<DefDoc | null> {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.source_id = d.doc_id
      WHERE dl.target_id = ? AND dl.link_type = 'contains'
      LIMIT 1
    `);
    const row = stmt.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  async getIncomingLinks(docId: string): Promise<DefIncomingLink[]> {
    const stmt = this.db.prepare("SELECT source_id, link_type FROM document_links WHERE target_id = ?");
    return (stmt.all(docId) as { source_id: string; link_type: string }[])
      .map(r => ({ source: r.source_id, type: r.link_type }));
  }

  async getOutgoingLinks(docId: string): Promise<{ target: string; type: string }[]> {
    const stmt = this.db.prepare("SELECT target_id, link_type FROM document_links WHERE source_id = ?");
    return (stmt.all(docId) as { target_id: string; link_type: string }[])
      .map(r => ({ target: r.target_id, type: r.link_type }));
  }

  async validate(): Promise<DefValidationResult> {
    const allDocs = await this.list({ limit: 10000 });
    const allIds = new Set(allDocs.map(d => d.docId));
    const referenced = new Set<string>();
    const issues: DefValidationResult["issues"] = [];

    for (const doc of allDocs) {
      if (doc.lifecycle === "deprecated") continue;
      const outgoing = await this.getOutgoingLinks(doc.docId);
      for (const link of outgoing) {
        referenced.add(link.target);
        if (!allIds.has(link.target)) {
          issues.push({ severity: "error", type: "broken-link", docId: doc.docId, message: `target "${link.target}" (${link.type})가 존재하지 않음` });
        }
      }
      const incoming = await this.getIncomingLinks(doc.docId);
      if (incoming.length > 0) referenced.add(doc.docId);
    }

    for (const doc of allDocs) {
      if (doc.lifecycle !== "approved") continue;
      if (!referenced.has(doc.docId)) {
        const outgoing = await this.getOutgoingLinks(doc.docId);
        if (!outgoing.some(l => l.type === "contains")) {
          issues.push({ severity: "warning", type: "orphan", docId: doc.docId, message: "approved 리프이지만 어디에도 참조되지 않음" });
        }
      }
    }

    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }

  close() {
    this.db.close();
  }
}
