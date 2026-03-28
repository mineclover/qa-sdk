/**
 * SearchService — FTS5 전문 검색 엔진
 *
 * drizzle이 관리하지 않는 FTS5 VIRTUAL TABLE의 lifecycle을 독립 관리.
 * - onModuleInit: FTS5 테이블 생성 (IF NOT EXISTS)
 * - index: 문서 인덱싱 (upsert 시 호출)
 * - search: 전문 검색
 *
 * 나중에 외부 검색엔진(Meilisearch 등)으로 교체 시 이 모듈만 변경.
 */

import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type Database from "better-sqlite3";
import { DATABASE } from "../../database.module.js";
import { createLogger } from "@qa-sdk/core";
import type { DocRecord } from "../../core/types.js";

const logger = createLogger("definition-service");

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

@Injectable()
export class SearchService implements OnModuleInit {
  private stmtUpsert!: Database.Statement;
  private stmtDelete!: Database.Statement;
  private ftsMode: "trigram" | "default" = "default";

  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  /** FTS5 테이블 생성 보장 — 마이그레이션 직접 DDL + 런타임 fallback */
  onModuleInit() {
    // trigram 토크나이저: CJK(한국어/중국어/일본어) 검색 지원
    // trigram은 3글자 단위로 토큰을 생성하여 부분 문자열 매칭 가능
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          doc_id, purpose, intent, context, caveat,
          content='documents', content_rowid='rowid',
          tokenize='trigram'
        )
      `);
      this.ftsMode = "trigram";
    } catch {
      // trigram 미지원 환경 fallback (구버전 SQLite)
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          doc_id, purpose, intent, context, caveat,
          content='documents', content_rowid='rowid'
        )
      `);
      this.ftsMode = "default";
    }

    this.stmtUpsert = this.db.prepare(
      "INSERT INTO documents_fts (doc_id, purpose, intent, context, caveat) VALUES (?, ?, ?, ?, ?)",
    );
    this.stmtDelete = this.db.prepare(
      "INSERT INTO documents_fts (documents_fts, doc_id, purpose, intent, context, caveat) VALUES ('delete', ?, ?, ?, ?, ?)",
    );

    logger.info({ tokenizer: this.ftsMode }, "FTS5 search index 준비 완료");
  }

  /** 문서 인덱싱 (upsert 후 호출) */
  index(docId: string, purpose?: string, intent?: string, context?: string, caveat?: string) {
    try {
      // 기존 엔트리 삭제 시도 (없으면 무시)
      const existing = this.db.prepare("SELECT purpose, intent, context, caveat FROM documents WHERE doc_id = ?").get(docId) as Record<string, unknown> | undefined;
      if (existing) {
        try {
          this.stmtDelete.run(
            docId,
            existing["purpose"] ?? "",
            existing["intent"] ?? "",
            existing["context"] ?? "",
            existing["caveat"] ?? "",
          );
        } catch { /* 첫 인덱싱 시 삭제할 것 없음 */ }
      }
      this.stmtUpsert.run(docId, purpose ?? "", intent ?? "", context ?? "", caveat ?? "");
    } catch {
      // FTS 인덱싱 실패가 저장을 차단하지 않음
    }
  }

  /** 전문 검색 */
  search(query: string, limit = 50, offset = 0): DocRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ?
        LIMIT ? OFFSET ?
      `);
      const results = (stmt.all(query, limit, offset) as Record<string, unknown>[]).map(rowToDoc);
      if (results.length > 0) return results;
    } catch {
      // FTS MATCH 실패 시 LIKE fallback
    }

    // LIKE fallback — FTS5 매칭 실패 또는 결과 없을 때 (한국어 등)
    return this.searchByLike(query, limit, offset);
  }

  /** 검색 결과 전체 건수 */
  searchCount(query: string): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as cnt FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ?
      `);
      const row = stmt.get(query) as { cnt: number };
      if (row.cnt > 0) return row.cnt;
    } catch {
      // FTS MATCH 실패 시 LIKE fallback
    }
    return this.searchCountByLike(query);
  }

  /** LIKE 기반 검색 (CJK fallback) */
  private searchByLike(query: string, limit: number, offset: number): DocRecord[] {
    const pattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM documents
      WHERE purpose LIKE ? OR intent LIKE ? OR context LIKE ? OR caveat LIKE ? OR doc_id LIKE ?
      ORDER BY doc_id LIMIT ? OFFSET ?
    `);
    return (stmt.all(pattern, pattern, pattern, pattern, pattern, limit, offset) as Record<string, unknown>[]).map(rowToDoc);
  }

  private searchCountByLike(query: string): number {
    const pattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM documents
      WHERE purpose LIKE ? OR intent LIKE ? OR context LIKE ? OR caveat LIKE ? OR doc_id LIKE ?
    `);
    return (stmt.get(pattern, pattern, pattern, pattern, pattern) as { cnt: number }).cnt;
  }
}
