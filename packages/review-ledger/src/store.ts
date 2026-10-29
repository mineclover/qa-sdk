// @def.boundary system-root
/**
 * SqliteReviewStore — review_entries 테이블 CRUD.
 *
 * node:sqlite + drizzle-orm 기반.
 * 어펜드 전용 원장: insert만. 현재 상태는 파일별 최신 레코드로 파생.
 */

import { createLogger } from '@qa-sdk/core';
import { getDatabaseSync, type DatabaseSyncInstance } from 'index-meta-store';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';

const logger = createLogger('review-ledger');
import { eq, and, desc, max, count, inArray } from 'drizzle-orm';
import { reviewEntries, feedbackRequests } from './db/schema.js';
import type { FeedbackRequest, FeedbackRequestStatus, ReviewEntry } from './types.js';

type DrizzleDb = ReturnType<typeof drizzle>;

export class SqliteReviewStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string = ':memory:') {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec('PRAGMA journal_mode = WAL');
    this.rawDb.exec('PRAGMA busy_timeout = 3000');

    this.db = drizzle({ client: this.rawDb });
    try {
      migrate(this.db, {
        migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
      });
    } catch (err) {
      logger.error({ err }, 'drizzle 마이그레이션 실패');
      throw err;
    }
  }

  /** 리뷰 엔트리 추가. 같은 file+commit 조합이면 건너뜀(UNIQUE 제약). 반환: 삽입 여부 */
  insert(entry: Omit<ReviewEntry, 'id'>): boolean {
    try {
      this.db
        .insert(reviewEntries)
        .values({
          filePath: entry.filePath,
          reviewedCommit: entry.reviewedCommit,
          reviewedAt: entry.reviewedAt,
          reviewer: entry.reviewer,
          aiModel: entry.aiModel,
          serviceScope: entry.serviceScope,
          notes: entry.notes,
        })
        .run();
      return true;
    } catch (e: unknown) {
      // UNIQUE 제약 위반 → 이미 같은 커밋으로 기록됨
      if (e instanceof Error && e.message.includes('UNIQUE')) return false;
      throw e;
    }
  }

  /** 파일별 최신 리뷰 엔트리 조회 */
  getLatestByFile(filePath: string): ReviewEntry | null {
    const rows = this.db
      .select()
      .from(reviewEntries)
      .where(eq(reviewEntries.filePath, filePath))
      .orderBy(desc(reviewEntries.id))
      .limit(1)
      .all();
    return rows.length > 0 ? this.toEntry(rows[0]) : null;
  }

  /** 여러 파일의 최신 리뷰 엔트리를 한 번에 조회. 반환: Map<filePath, ReviewEntry> */
  getLatestByFiles(filePaths: string[]): Map<string, ReviewEntry> {
    if (filePaths.length === 0) return new Map();

    // 서브쿼리: 파일별 max(id)
    const latestSub = this.db
      .select({
        maxId: max(reviewEntries.id).as('max_id'),
      })
      .from(reviewEntries)
      .where(inArray(reviewEntries.filePath, filePaths))
      .groupBy(reviewEntries.filePath)
      .as('latest');

    const rows = this.db
      .select({
        id: reviewEntries.id,
        filePath: reviewEntries.filePath,
        reviewedCommit: reviewEntries.reviewedCommit,
        reviewedAt: reviewEntries.reviewedAt,
        reviewer: reviewEntries.reviewer,
        aiModel: reviewEntries.aiModel,
        serviceScope: reviewEntries.serviceScope,
        notes: reviewEntries.notes,
      })
      .from(reviewEntries)
      .innerJoin(latestSub, eq(reviewEntries.id, latestSub.maxId))
      .all();

    const result = new Map<string, ReviewEntry>();
    for (const row of rows) {
      result.set(row.filePath, this.toEntry(row));
    }
    return result;
  }

  /** 서비스 스코프별 최신 리뷰 엔트리 목록 */
  getLatestByScope(scope: string): ReviewEntry[] {
    // 서브쿼리: scope 내 파일별 max(id)
    const latestSub = this.db
      .select({
        maxId: max(reviewEntries.id).as('max_id'),
      })
      .from(reviewEntries)
      .where(eq(reviewEntries.serviceScope, scope))
      .groupBy(reviewEntries.filePath)
      .as('latest');

    const rows = this.db
      .select({
        id: reviewEntries.id,
        filePath: reviewEntries.filePath,
        reviewedCommit: reviewEntries.reviewedCommit,
        reviewedAt: reviewEntries.reviewedAt,
        reviewer: reviewEntries.reviewer,
        aiModel: reviewEntries.aiModel,
        serviceScope: reviewEntries.serviceScope,
        notes: reviewEntries.notes,
      })
      .from(reviewEntries)
      .innerJoin(latestSub, eq(reviewEntries.id, latestSub.maxId))
      .orderBy(desc(reviewEntries.reviewedAt))
      .all();

    return rows.map((r) => this.toEntry(r));
  }

  /** 모든 파일의 최신 리뷰 엔트리 */
  getAllLatest(): ReviewEntry[] {
    // 서브쿼리: 전체 파일별 max(id)
    const latestSub = this.db
      .select({
        maxId: max(reviewEntries.id).as('max_id'),
      })
      .from(reviewEntries)
      .groupBy(reviewEntries.filePath)
      .as('latest');

    const rows = this.db
      .select({
        id: reviewEntries.id,
        filePath: reviewEntries.filePath,
        reviewedCommit: reviewEntries.reviewedCommit,
        reviewedAt: reviewEntries.reviewedAt,
        reviewer: reviewEntries.reviewer,
        aiModel: reviewEntries.aiModel,
        serviceScope: reviewEntries.serviceScope,
        notes: reviewEntries.notes,
      })
      .from(reviewEntries)
      .innerJoin(latestSub, eq(reviewEntries.id, latestSub.maxId))
      .orderBy(desc(reviewEntries.reviewedAt))
      .all();

    return rows.map((r) => this.toEntry(r));
  }

  /** 파일별 리뷰 이력 (최신 순) */
  history(filePath: string, limit = 20): ReviewEntry[] {
    const rows = this.db
      .select()
      .from(reviewEntries)
      .where(eq(reviewEntries.filePath, filePath))
      .orderBy(desc(reviewEntries.id))
      .limit(limit)
      .all();
    return rows.map((r) => this.toEntry(r));
  }

  /** 등록된 전체 서비스 스코프 목록 */
  listScopes(): string[] {
    const rows = this.db
      .selectDistinct({ serviceScope: reviewEntries.serviceScope })
      .from(reviewEntries)
      .orderBy(reviewEntries.serviceScope)
      .all();
    return rows.map((r) => r.serviceScope);
  }

  /** 전체 엔트리 수 */
  count(): number {
    const row = this.db.select({ cnt: count() }).from(reviewEntries).get();
    return row?.cnt ?? 0;
  }

  close(): void {
    this.rawDb.close();
  }

  // ── Feedback Request ───────────────────────────────

  insertFeedbackRequest(entry: FeedbackRequest): void {
    this.db
      .insert(feedbackRequests)
      .values({
        id: entry.id,
        createdAt: entry.createdAt,
        requestedBy: entry.requestedBy,
        purpose: entry.purpose,
        targetModel: entry.targetModel,
        serviceScope: entry.serviceScope,
        status: entry.status,
        notes: entry.notes,
        prompt: entry.prompt,
        evidenceBundle: JSON.stringify(entry.evidenceBundle),
      })
      .run();
  }

  getFeedbackRequest(id: string): FeedbackRequest | null {
    const row = this.db
      .select()
      .from(feedbackRequests)
      .where(eq(feedbackRequests.id, id))
      .limit(1)
      .get();
    return row ? this.toFeedbackRequest(row) : null;
  }

  listFeedbackRequests(filter?: {
    scope?: string;
    status?: FeedbackRequestStatus;
    limit?: number;
  }): FeedbackRequest[] {
    const conditions = [
      filter?.scope ? eq(feedbackRequests.serviceScope, filter.scope) : undefined,
      filter?.status ? eq(feedbackRequests.status, filter.status) : undefined,
    ].filter(Boolean);

    let query = this.db.select().from(feedbackRequests).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = query
      .orderBy(desc(feedbackRequests.createdAt))
      .limit(filter?.limit ?? 20)
      .all();

    return rows.map((row) => this.toFeedbackRequest(row));
  }

  listFeedbackRequestsByDocId(docId: string, limit = 20): FeedbackRequest[] {
    return this.listFeedbackRequests({ limit: 200 })
      .filter((request) =>
        request.evidenceBundle.items.some((item) =>
          (item.relatedDocs ?? []).some((doc) => doc.docId === docId),
        ),
      )
      .slice(0, limit);
  }

  // ── private ─────────────────────────────────────────

  private toEntry(row: typeof reviewEntries.$inferSelect): ReviewEntry {
    return {
      id: row.id,
      filePath: row.filePath,
      reviewedCommit: row.reviewedCommit,
      reviewedAt: row.reviewedAt,
      reviewer: row.reviewer,
      aiModel: row.aiModel,
      serviceScope: row.serviceScope,
      notes: row.notes,
    };
  }

  private toFeedbackRequest(row: typeof feedbackRequests.$inferSelect): FeedbackRequest {
    const parsed = JSON.parse(row.evidenceBundle) as FeedbackRequest['evidenceBundle'];
    const normalizedBundle: FeedbackRequest['evidenceBundle'] = {
      ...parsed,
      items: parsed.items.map((item) => ({
        ...item,
        relatedDocs: item.relatedDocs ?? [],
      })),
    };

    return {
      id: row.id,
      createdAt: row.createdAt,
      requestedBy: row.requestedBy,
      purpose: row.purpose,
      targetModel: row.targetModel,
      serviceScope: row.serviceScope,
      status: row.status as FeedbackRequestStatus,
      notes: row.notes,
      prompt: row.prompt,
      evidenceBundle: normalizedBundle,
    };
  }
}
