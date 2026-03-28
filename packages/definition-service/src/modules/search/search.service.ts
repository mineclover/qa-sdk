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

  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  /** FTS5 테이블 생성 — drizzle 마이그레이션과 독립 */
  onModuleInit() {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        doc_id, purpose, intent, context, caveat,
        content='documents', content_rowid='rowid'
      )
    `);

    this.stmtUpsert = this.db.prepare(
      "INSERT INTO documents_fts (doc_id, purpose, intent, context, caveat) VALUES (?, ?, ?, ?, ?)",
    );
    this.stmtDelete = this.db.prepare(
      "INSERT INTO documents_fts (documents_fts, doc_id, purpose, intent, context, caveat) VALUES ('delete', ?, ?, ?, ?, ?)",
    );

    logger.info("FTS5 search index 준비 완료");
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
  search(query: string, limit = 50): DocRecord[] {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN documents_fts fts ON fts.doc_id = d.doc_id
      WHERE documents_fts MATCH ?
      LIMIT ?
    `);
    return (stmt.all(query, limit) as Record<string, unknown>[]).map(rowToDoc);
  }
}
