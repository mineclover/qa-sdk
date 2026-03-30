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
import { sql, eq, like, or, asc, count } from "drizzle-orm";
import { DATABASE, DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import { documents } from "../../db/schema.js";
import { createLogger } from "../../lib/logger.js";
import type { DocRecord } from "../../core/types.js";

const logger = createLogger("definition-service");

/** drizzle SELECT 결과 row → DocRecord 변환 */
function rowToDoc(row: typeof documents.$inferSelect): DocRecord {
  return {
    docId: row.docId,
    title: row.title || row.docId,
    level: row.level || undefined,
    scope: row.scope,
    aspect: row.aspect,
    depth: row.depth,
    lifecycle: row.lifecycle,
    layer: row.layer || undefined,
    tags: row.tagsJson,
    links: row.linksJson,
    svc: row.svc || undefined,
    address: row.address || undefined,
    targetPrefix: row.targetPrefix || undefined,
    version: row.version,
    bodyHash: row.bodyHash,
    purpose: row.purpose || undefined,
    intent: row.intent || undefined,
    context: row.context || undefined,
    caveat: row.caveat || undefined,
    gate: row.gateJson
      ? JSON.parse(row.gateJson) as DocRecord["gate"]
      : undefined,
    syncedAt: row.syncedAt,
    sourcePath: row.sourcePath || undefined,
  };
}

@Injectable()
export class SearchService implements OnModuleInit {
  private ftsMode: "trigram" | "default" = "default";

  constructor(
    /** FTS5 DDL용 — drizzle이 VIRTUAL TABLE을 지원하지 않으므로 raw exec 필요 */
    @Inject(DATABASE) private readonly rawDb: Database.Database,
    @Inject(DRIZZLE_DB) private readonly db: DefinitionServiceDatabase,
  ) {}

  /** FTS5 테이블 생성 보장 — 마이그레이션 직접 DDL + 런타임 fallback */
  onModuleInit() {
    // trigram 토크나이저: CJK(한국어/중국어/일본어) 검색 지원
    // trigram은 3글자 단위로 토큰을 생성하여 부분 문자열 매칭 가능
    try {
      this.rawDb.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          doc_id, purpose, intent, context, caveat,
          content='documents', content_rowid='rowid',
          tokenize='trigram'
        )
      `);
      this.ftsMode = "trigram";
    } catch {
      // trigram 미지원 환경 fallback (구버전 SQLite)
      this.rawDb.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          doc_id, purpose, intent, context, caveat,
          content='documents', content_rowid='rowid'
        )
      `);
      this.ftsMode = "default";
    }

    logger.info({ tokenizer: this.ftsMode }, "FTS5 search index 준비 완료");
  }

  /** 문서 인덱싱 (upsert 후 호출) */
  index(docId: string, purpose?: string, intent?: string, context?: string, caveat?: string) {
    try {
      // 기존 엔트리 삭제 시도 (없으면 무시)
      const existing = this.db
        .select({
          purpose: documents.purpose,
          intent: documents.intent,
          context: documents.context,
          caveat: documents.caveat,
        })
        .from(documents)
        .where(eq(documents.docId, docId))
        .get();

      if (existing) {
        try {
          this.db.run(sql`
            INSERT INTO documents_fts (documents_fts, doc_id, purpose, intent, context, caveat)
            VALUES ('delete', ${docId}, ${existing.purpose ?? ""}, ${existing.intent ?? ""}, ${existing.context ?? ""}, ${existing.caveat ?? ""})
          `);
        } catch { /* 첫 인덱싱 시 삭제할 것 없음 */ }
      }
      this.db.run(sql`
        INSERT INTO documents_fts (doc_id, purpose, intent, context, caveat)
        VALUES (${docId}, ${purpose ?? ""}, ${intent ?? ""}, ${context ?? ""}, ${caveat ?? ""})
      `);
    } catch {
      // FTS 인덱싱 실패가 저장을 차단하지 않음
    }
  }

  /** 전문 검색 */
  search(query: string, limit = 50, offset = 0): DocRecord[] {
    try {
      // FTS5 MATCH — 가상 테이블 JOIN은 drizzle 스키마에 없으므로 sql 태그 사용
      const results = this.db.all<typeof documents.$inferSelect>(sql`
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ${query}
        LIMIT ${limit} OFFSET ${offset}
      `);
      if (results.length > 0) return results.map(rowToDoc);
    } catch {
      // FTS MATCH 실패 시 LIKE fallback
    }

    // LIKE fallback — FTS5 매칭 실패 또는 결과 없을 때 (한국어 등)
    return this.searchByLike(query, limit, offset);
  }

  /** 검색 결과 전체 건수 */
  searchCount(query: string): number {
    try {
      const row = this.db.get<{ cnt: number }>(sql`
        SELECT COUNT(*) as cnt FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ${query}
      `);
      if (row && row.cnt > 0) return row.cnt;
    } catch {
      // FTS MATCH 실패 시 LIKE fallback
    }
    return this.searchCountByLike(query);
  }

  /** LIKE 기반 검색 (CJK fallback) */
  private searchByLike(query: string, limit: number, offset: number): DocRecord[] {
    const pattern = `%${query}%`;
    return this.db
      .select()
      .from(documents)
      .where(
        or(
          like(documents.purpose, pattern),
          like(documents.intent, pattern),
          like(documents.context, pattern),
          like(documents.caveat, pattern),
          like(documents.docId, pattern),
        ),
      )
      .orderBy(asc(documents.docId))
      .limit(limit)
      .offset(offset)
      .all()
      .map(rowToDoc);
  }

  private searchCountByLike(query: string): number {
    const pattern = `%${query}%`;
    const result = this.db
      .select({ cnt: count() })
      .from(documents)
      .where(
        or(
          like(documents.purpose, pattern),
          like(documents.intent, pattern),
          like(documents.context, pattern),
          like(documents.caveat, pattern),
          like(documents.docId, pattern),
        ),
      )
      .get();
    return result?.cnt ?? 0;
  }
}
