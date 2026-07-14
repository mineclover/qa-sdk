// @def.boundary system-root
/**
 * ReviewLedger — 리뷰 기록 오케스트레이션.
 *
 * store(SQLite) + staleness(git) + scope-resolver를 조합하여
 * mark / status / dashboard / history API를 제공한다.
 */

import { SqliteReviewStore } from './store.js';
import { resolveScope } from './scope-resolver.js';
import { buildEvidenceBundle, createFeedbackRequest } from './feedback-request.js';
import {
  getHeadCommit,
  getLatestCommitForFile,
  getLatestCommitsForFiles,
  listTrackedFiles,
} from './staleness.js';
import type {
  CreateFeedbackRequestInput,
  MarkReviewInput,
  MarkResult,
  FeedbackRequest,
  FileReviewStatus,
  ReviewEntry,
  ServiceCoverage,
} from './types.js';

export class ReviewLedger {
  readonly store: SqliteReviewStore;
  readonly cwd: string;

  constructor(store: SqliteReviewStore, cwd: string) {
    this.store = store;
    this.cwd = cwd;
  }

  // ── 기록 ────────────────────────────────────────────

  /** 파일들을 리뷰 완료로 기록한다 */
  mark(input: MarkReviewInput): MarkResult {
    const fallbackCommit = input.commit ?? getHeadCommit(this.cwd);
    const reviewedAt = new Date().toISOString();
    let marked = 0;
    let skipped = 0;

    for (const filePath of input.filePaths) {
      const commit = input.commit ?? getLatestCommitForFile(this.cwd, filePath) ?? fallbackCommit;
      const serviceScope = resolveScope(filePath);
      const inserted = this.store.insert({
        filePath,
        reviewedCommit: commit,
        reviewedAt,
        reviewer: input.reviewer,
        aiModel: input.aiModel ?? null,
        serviceScope,
        notes: input.notes ?? null,
      });
      if (inserted) marked++;
      else skipped++;
    }

    return { marked, skipped, commit: fallbackCommit };
  }

  // ── 단건 상태 ───────────────────────────────────────

  /** 단일 파일의 리뷰 상태를 조회한다 */
  statusForFile(filePath: string): FileReviewStatus {
    const entry = this.store.getLatestByFile(filePath);
    const latestCommits = getLatestCommitsForFiles(this.cwd, [filePath]);
    const latestFileCommit = latestCommits.get(filePath) ?? null;

    return this.buildFileStatus(filePath, entry, latestFileCommit);
  }

  // ── 범위 상태 ───────────────────────────────────────

  /** 특정 서비스 스코프의 모든 파일 리뷰 상태 */
  statusForScope(scope: string): FileReviewStatus[] {
    // git 추적 파일 중 해당 scope에 속하는 것만 필터
    const allFiles = listTrackedFiles(this.cwd);
    const scopeFiles = allFiles.filter((f) => resolveScope(f) === scope);
    return this.buildStatuses(scopeFiles);
  }

  /** 전체 파일 리뷰 상태. 필터 옵션으로 stale/unreviewed만 조회 가능 */
  statusAll(filter?: {
    stale?: boolean;
    unreviewed?: boolean;
    scope?: string;
  }): FileReviewStatus[] {
    let files = listTrackedFiles(this.cwd);
    if (filter?.scope) {
      files = files.filter((f) => resolveScope(f) === filter.scope);
    }

    const statuses = this.buildStatuses(files);

    if (filter?.stale && filter?.unreviewed) {
      return statuses.filter((s) => s.status === 'stale' || s.status === 'unreviewed');
    }
    if (filter?.stale) return statuses.filter((s) => s.status === 'stale');
    if (filter?.unreviewed) return statuses.filter((s) => s.status === 'unreviewed');
    return statuses;
  }

  // ── 대시보드 ────────────────────────────────────────

  /** 서비스 스코프별 리뷰 커버리지 대시보드 */
  dashboard(): ServiceCoverage[] {
    const allFiles = listTrackedFiles(this.cwd);
    const statuses = this.buildStatuses(allFiles);

    // 스코프별 집계
    const scopeMap = new Map<
      string,
      { total: number; reviewed: number; stale: number; unreviewed: number }
    >();

    for (const s of statuses) {
      let agg = scopeMap.get(s.serviceScope);
      if (!agg) {
        agg = { total: 0, reviewed: 0, stale: 0, unreviewed: 0 };
        scopeMap.set(s.serviceScope, agg);
      }
      agg.total++;
      agg[s.status]++;
    }

    return Array.from(scopeMap.entries())
      .map(([serviceScope, agg]) =>
        Object.assign({ serviceScope }, agg, {
          coveragePercent: agg.total > 0 ? Math.round((agg.reviewed / agg.total) * 1000) / 10 : 0,
        }),
      )
      .toSorted((a, b) => a.serviceScope.localeCompare(b.serviceScope));
  }

  // ── 이력 ────────────────────────────────────────────

  /** 파일의 리뷰 이력 (최신 순) */
  history(filePath: string, limit = 20): ReviewEntry[] {
    return this.store.history(filePath, limit);
  }

  // ── Feedback Request ───────────────────────────────

  createFeedbackRequest(input: CreateFeedbackRequestInput): FeedbackRequest {
    const filePaths = this.resolveFeedbackFiles(input);
    const statuses = this.buildStatuses(filePaths);
    const evidenceBundle = buildEvidenceBundle(statuses, input.relatedDocsByFile ?? {});
    const request = createFeedbackRequest(input, evidenceBundle);
    this.store.insertFeedbackRequest(request);
    return request;
  }

  getFeedbackRequest(id: string): FeedbackRequest | null {
    return this.store.getFeedbackRequest(id);
  }

  listFeedbackRequests(filter?: {
    scope?: string;
    status?: FeedbackRequest['status'];
    limit?: number;
  }): FeedbackRequest[] {
    return this.store.listFeedbackRequests(filter);
  }

  listFeedbackRequestsByDocId(docId: string, limit = 20): FeedbackRequest[] {
    return this.store.listFeedbackRequestsByDocId(docId, limit);
  }

  close(): void {
    this.store.close();
  }

  // ── private ─────────────────────────────────────────

  private buildStatuses(filePaths: string[]): FileReviewStatus[] {
    // 배치로 최신 커밋 조회
    const latestCommits = getLatestCommitsForFiles(this.cwd, filePaths);
    // 배치로 최신 리뷰 엔트리 조회
    const latestEntries = this.store.getLatestByFiles(filePaths);

    return filePaths.map((fp) => {
      const entry = latestEntries.get(fp) ?? null;
      const latestFileCommit = latestCommits.get(fp) ?? null;
      return this.buildFileStatus(fp, entry, latestFileCommit);
    });
  }

  private resolveFeedbackFiles(input: CreateFeedbackRequestInput): string[] {
    if (input.filePaths && input.filePaths.length > 0) {
      return [...new Set(input.filePaths)];
    }

    const allFiles = listTrackedFiles(this.cwd);
    if (input.serviceScope) {
      return allFiles.filter((filePath) => resolveScope(filePath) === input.serviceScope);
    }

    return allFiles;
  }

  private buildFileStatus(
    filePath: string,
    entry: ReviewEntry | null,
    latestFileCommit: string | null,
  ): FileReviewStatus {
    const serviceScope = resolveScope(filePath);

    if (!entry) {
      return {
        filePath,
        status: 'unreviewed',
        serviceScope,
        lastEntry: null,
        latestFileCommit,
      };
    }

    // 리뷰 커밋과 파일의 최신 커밋이 같으면 reviewed
    const stale = latestFileCommit !== null && latestFileCommit !== entry.reviewedCommit;

    return {
      filePath,
      status: stale ? 'stale' : 'reviewed',
      serviceScope,
      lastEntry: entry,
      latestFileCommit,
    };
  }
}
