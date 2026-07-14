// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG } from 'demo-snapshot';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { bootstrapDkg } from 'dkg-enrichment';
import { DkgSqliteStore } from 'dkg/store';
import type { FeedbackRequest } from 'review-ledger';
import { bridgeFeedbackRequestToDkg, buildFeedbackObservation } from './review-feedback-dkg.js';

function makeRequest(): FeedbackRequest {
  return {
    id: 'frq_test_001',
    createdAt: '2026-03-29T00:00:00.000Z',
    requestedBy: 'junwoo',
    purpose: '리뷰 원장 기반 DKG 브릿지 검토',
    targetModel: 'gpt-5.4',
    serviceScope: 'review-ledger',
    status: 'open',
    notes: null,
    prompt: 'test',
    evidenceBundle: {
      total: 2,
      reviewed: 0,
      stale: 1,
      unreviewed: 1,
      items: [
        {
          filePath: 'packages/review-ledger/src/types.ts',
          serviceScope: 'review-ledger',
          status: 'stale',
          latestFileCommit: 'a',
          reviewedCommit: 'b',
          reviewedAt: '2026-03-28T00:00:00.000Z',
          reviewer: 'alice',
          aiModel: 'gpt-5.4',
          notes: null,
        },
        {
          filePath: 'packages/review-ledger/src/ledger.ts',
          serviceScope: 'review-ledger',
          status: 'unreviewed',
          latestFileCommit: null,
          reviewedCommit: null,
          reviewedAt: null,
          reviewer: null,
          aiModel: null,
          notes: null,
        },
      ],
    },
  };
}

describe('review-feedback-dkg', () => {
  it('feedback request에서 observation을 만든다', () => {
    const request = makeRequest();
    const observation = buildFeedbackObservation(request, 'permission');

    expect(observation.id).toBe('OBS-REVIEW-frq_test_001');
    expect(observation.source).toBe('review');
    expect(observation.intent).toBe('action-needed');
    expect(observation.subjects).toContain('permission');
    expect(observation.metadata?.feedbackRequestId).toBe(request.id);
  });

  it('feedback request를 DKG observation으로 저장한다', () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const store = new DkgSqliteStore(':memory:', 'demo');

    const result = bridgeFeedbackRequestToDkg(makeRequest(), {
      targetId: 'permission',
      context: { graph, store },
    });

    expect(result.observationId).toBe('OBS-REVIEW-frq_test_001');
    const loaded = store.loadGraph().getNode(result.observationId);
    expect(loaded).toBeDefined();
    expect(store.loadGraph().edgesFrom(result.observationId, 'observes')[0]?.to).toBe('permission');
    store.close();
  });

  it('decision 생성과 prompts 연결을 함께 저장한다', () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const store = new DkgSqliteStore(':memory:', 'demo');

    const result = bridgeFeedbackRequestToDkg(makeRequest(), {
      targetId: 'permission',
      decision: {
        type: 'deprecate',
        title: '리뷰 피드백 기반 권한 정리',
        rationale: 'stale/unreviewed 파일이 누적되어 의사결정 기록이 필요',
      },
      context: { graph, store },
    });

    expect(result.createdDecision).toBe(true);
    expect(result.decisionId).toBeDefined();
    const loaded = store.loadGraph();
    expect(loaded.getNode(result.decisionId!)).toBeDefined();
    expect(loaded.edgesFrom(result.observationId, 'prompts')[0]?.to).toBe(result.decisionId);
    store.close();
  });
});
