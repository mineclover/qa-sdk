import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteReviewStore } from './store.js';
import {
  buildEvidenceBundle,
  createFeedbackRequest,
  renderFeedbackPrompt,
} from './feedback-request.js';
import { resolveScope } from './scope-resolver.js';

// ── scope-resolver ────────────────────────────────────

describe('resolveScope', () => {
  it('packages/<name>/... → 패키지 이름', () => {
    expect(resolveScope('packages/ingest-server/src/main.ts')).toBe('ingest-server');
    expect(resolveScope('packages/core/src/index.ts')).toBe('core');
  });

  it('docs/specs/<domain>/... → docs:<domain>', () => {
    expect(resolveScope('docs/specs/decision-flow/overview.md')).toBe('docs:decision-flow');
  });

  it('docs/... → docs', () => {
    expect(resolveScope('docs/README.md')).toBe('docs');
  });

  it('.github/... → ci', () => {
    expect(resolveScope('.github/workflows/ci.yml')).toBe('ci');
  });

  it('루트 파일 → root', () => {
    expect(resolveScope('package.json')).toBe('root');
    expect(resolveScope('tsconfig.json')).toBe('root');
  });

  it('Windows 경로도 처리', () => {
    expect(resolveScope('packages\\cli\\src\\index.ts')).toBe('cli');
  });
});

// ── SqliteReviewStore ─────────────────────────────────

describe('SqliteReviewStore', () => {
  let store: SqliteReviewStore;

  beforeEach(() => {
    store = new SqliteReviewStore(':memory:');
  });

  it('insert + getLatestByFile', () => {
    store.insert({
      filePath: 'packages/core/src/index.ts',
      reviewedCommit: 'abc123',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: 'claude-opus-4-6',
      serviceScope: 'core',
      notes: null,
    });

    const entry = store.getLatestByFile('packages/core/src/index.ts');
    expect(entry).not.toBeNull();
    expect(entry!.reviewer).toBe('junwoo');
    expect(entry!.aiModel).toBe('claude-opus-4-6');
    expect(entry!.reviewedCommit).toBe('abc123');
  });

  it('같은 file+commit UNIQUE 제약 → 건너뜀', () => {
    const inserted1 = store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'abc123',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });
    const inserted2 = store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'abc123',
      reviewedAt: '2026-03-29T01:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });
    expect(inserted1).toBe(true);
    expect(inserted2).toBe(false);
    expect(store.count()).toBe(1);
  });

  it('같은 파일, 다른 커밋 → 최신 엔트리 반환', () => {
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'commit1',
      reviewedAt: '2026-03-28T00:00:00Z',
      reviewer: 'alice',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'commit2',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'bob',
      aiModel: 'claude-opus-4-6',
      serviceScope: 'root',
      notes: '두 번째 리뷰',
    });

    const latest = store.getLatestByFile('a.ts');
    expect(latest!.reviewer).toBe('bob');
    expect(latest!.reviewedCommit).toBe('commit2');
  });

  it('getLatestByFiles 배치 조회', () => {
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'c1',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });
    store.insert({
      filePath: 'b.ts',
      reviewedCommit: 'c2',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });

    const map = store.getLatestByFiles(['a.ts', 'b.ts', 'c.ts']);
    expect(map.size).toBe(2);
    expect(map.get('a.ts')!.reviewedCommit).toBe('c1');
    expect(map.get('b.ts')!.reviewedCommit).toBe('c2');
    expect(map.has('c.ts')).toBe(false);
  });

  it('getLatestByScope', () => {
    store.insert({
      filePath: 'packages/core/a.ts',
      reviewedCommit: 'c1',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'core',
      notes: null,
    });
    store.insert({
      filePath: 'packages/cli/b.ts',
      reviewedCommit: 'c2',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'cli',
      notes: null,
    });

    const coreEntries = store.getLatestByScope('core');
    expect(coreEntries).toHaveLength(1);
    expect(coreEntries[0].filePath).toBe('packages/core/a.ts');
  });

  it('history 최신순 반환', () => {
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'c1',
      reviewedAt: '2026-03-28T00:00:00Z',
      reviewer: 'alice',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'c2',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'bob',
      aiModel: null,
      serviceScope: 'root',
      notes: null,
    });

    const hist = store.history('a.ts');
    expect(hist).toHaveLength(2);
    expect(hist[0].reviewer).toBe('bob'); // 최신 먼저
    expect(hist[1].reviewer).toBe('alice');
  });

  it('listScopes', () => {
    store.insert({
      filePath: 'a.ts',
      reviewedCommit: 'c1',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'core',
      notes: null,
    });
    store.insert({
      filePath: 'b.ts',
      reviewedCommit: 'c1',
      reviewedAt: '2026-03-29T00:00:00Z',
      reviewer: 'junwoo',
      aiModel: null,
      serviceScope: 'cli',
      notes: null,
    });

    const scopes = store.listScopes();
    expect(scopes).toEqual(['cli', 'core']);
  });

  it('빈 파일 목록 getLatestByFiles → 빈 Map', () => {
    const map = store.getLatestByFiles([]);
    expect(map.size).toBe(0);
  });

  it('feedback request 저장/조회', () => {
    const request = createFeedbackRequest(
      {
        requestedBy: 'junwoo',
        purpose: 'stale 파일 기반 피드백 요청',
        targetModel: 'gpt-5.4',
        serviceScope: 'core',
      },
      {
        total: 1,
        reviewed: 0,
        stale: 1,
        unreviewed: 0,
        items: [
          {
            filePath: 'packages/core/src/index.ts',
            serviceScope: 'core',
            status: 'stale',
            latestFileCommit: 'latest123',
            reviewedCommit: 'review123',
            reviewedAt: '2026-03-29T00:00:00Z',
            reviewer: 'alice',
            aiModel: 'claude-opus-4-6',
            notes: '재검토 필요',
            relatedDocs: [],
          },
        ],
      },
    );

    store.insertFeedbackRequest(request);
    const loaded = store.getFeedbackRequest(request.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.purpose).toBe('stale 파일 기반 피드백 요청');
    expect(loaded!.evidenceBundle.stale).toBe(1);
    expect(loaded!.prompt).toContain('# Feedback Request');
  });

  it('feedback request 목록 조회', () => {
    const requestA = createFeedbackRequest(
      {
        requestedBy: 'junwoo',
        purpose: 'core 피드백',
        serviceScope: 'core',
      },
      {
        total: 0,
        reviewed: 0,
        stale: 0,
        unreviewed: 0,
        items: [],
      },
    );
    const requestB = createFeedbackRequest(
      {
        requestedBy: 'junwoo',
        purpose: 'cli 피드백',
        serviceScope: 'cli',
      },
      {
        total: 0,
        reviewed: 0,
        stale: 0,
        unreviewed: 0,
        items: [],
      },
    );

    store.insertFeedbackRequest(requestA);
    store.insertFeedbackRequest(requestB);

    const coreOnly = store.listFeedbackRequests({ scope: 'core' });
    expect(coreOnly).toHaveLength(1);
    expect(coreOnly[0].serviceScope).toBe('core');
  });

  it('docId로 관련 feedback request를 조회한다', () => {
    const request = createFeedbackRequest(
      {
        requestedBy: 'junwoo',
        purpose: 'review-ledger 관련 피드백',
        serviceScope: 'review-ledger',
      },
      {
        total: 1,
        reviewed: 0,
        stale: 0,
        unreviewed: 1,
        items: [
          {
            filePath: 'packages/review-ledger/src/types.ts',
            serviceScope: 'review-ledger',
            status: 'unreviewed',
            latestFileCommit: null,
            reviewedCommit: null,
            reviewedAt: null,
            reviewer: null,
            aiModel: null,
            notes: null,
            relatedDocs: [
              {
                docId: 'review-ledger-spec',
                scope: 'feature',
                aspect: 'func_def',
                depth: 'specification',
                reason: 'service-scope',
              },
            ],
          },
        ],
      },
    );

    store.insertFeedbackRequest(request);
    const found = store.listFeedbackRequestsByDocId('review-ledger-spec');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(request.id);
  });
});

// ── Feedback Request Helpers ──────────────────────────

describe('feedback-request helpers', () => {
  it('FileReviewStatus → EvidenceBundle 변환', () => {
    const bundle = buildEvidenceBundle([
      {
        filePath: 'packages/core/src/index.ts',
        status: 'reviewed',
        serviceScope: 'core',
        latestFileCommit: 'c1',
        lastEntry: {
          id: 1,
          filePath: 'packages/core/src/index.ts',
          reviewedCommit: 'c1',
          reviewedAt: '2026-03-29T00:00:00Z',
          reviewer: 'junwoo',
          aiModel: null,
          serviceScope: 'core',
          notes: null,
        },
      },
      {
        filePath: 'packages/cli/src/index.ts',
        status: 'unreviewed',
        serviceScope: 'cli',
        latestFileCommit: 'c2',
        lastEntry: null,
      },
    ]);

    expect(bundle.total).toBe(2);
    expect(bundle.reviewed).toBe(1);
    expect(bundle.unreviewed).toBe(1);
    expect(bundle.items[0]?.relatedDocs).toEqual([]);
  });

  it('prompt에 evidence summary와 file 목록이 포함된다', () => {
    const prompt = renderFeedbackPrompt({
      purpose: '릴리즈 전 구조 리뷰',
      requestedBy: 'junwoo',
      targetModel: 'gpt-5.4',
      serviceScope: 'core',
      notes: '최근 stale 파일 우선',
      evidenceBundle: {
        total: 1,
        reviewed: 0,
        stale: 1,
        unreviewed: 0,
        items: [
          {
            filePath: 'packages/core/src/index.ts',
            serviceScope: 'core',
            status: 'stale',
            latestFileCommit: 'latest123',
            reviewedCommit: 'review123',
            reviewedAt: '2026-03-29T00:00:00Z',
            reviewer: 'alice',
            aiModel: null,
            notes: null,
            relatedDocs: [
              {
                docId: 'core-guide',
                scope: 'flow',
                aspect: 'user_scenario',
                depth: 'overview',
                reason: 'service-scope',
              },
            ],
          },
        ],
      },
    });

    expect(prompt).toContain('## Evidence Summary');
    expect(prompt).toContain('[stale] packages/core/src/index.ts');
    expect(prompt).toContain('docs: core-guide [service-scope]');
    expect(prompt).toContain('Requested Output');
  });
});
