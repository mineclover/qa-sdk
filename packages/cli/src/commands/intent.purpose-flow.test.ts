// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * @purpose P4 의도 문서 관리 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * 설계 결정을 기록 → DKG에 저장 → 다시 불러와 대상 prefix에서 결정을 추적한다.
 * 결정을 설명하는 문서는 대상 spec에 링크되고, 링크 그래프 검증을 통과한다.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Catalog } from '@qa-sdk/core';
import { MemoryDefinitionRegistry, validateGraph } from 'definition-catalog';
import { recordDecision, traceNode } from 'dkg';
import { DkgSqliteStore } from 'dkg/store';
import { bootstrapDkg } from 'dkg-enrichment';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { DEMO_CATALOG } from 'demo-snapshot';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const catalog = DEMO_CATALOG as unknown as Catalog;
const TARGET = 'order_event';
const NOW = '2026-10-29T00:00:00Z';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'purpose-p4-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('P4 의도 문서 관리 — 결정 기록 → 추적 → 문서 링크', () => {
  it('기록한 결정은 저장 후에도 대상에서 추적된다', () => {
    const graph = bootstrapDkg({ catalog, config: DEMO_DKG_CONFIG });
    const result = recordDecision(graph, {
      targetId: TARGET,
      type: 'dim-add',
      title: '주문 이벤트에 결제수단 차원 추가',
      rationale: '결제수단별 실패율을 좌표로 관측하기 위해',
      alternatives: ['payload 필드로 기록'],
      date: '2026-10-29',
    });
    expect(result.verdict).toBe('ok');
    const decision = result.decision!;

    const dbPath = join(dir, 'dkg.sqlite');
    const store = new DkgSqliteStore(dbPath);
    store.saveGraph(graph, 'bootstrap');
    store.saveNodes([decision], result.edges, 'manual');

    // 다른 프로세스가 다시 연 것처럼 저장소에서 그래프를 읽는다
    const reloaded = new DkgSqliteStore(dbPath).loadGraph();
    const trace = traceNode(reloaded, catalog, TARGET);
    expect(trace?.directDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: decision.id,
          title: '주문 이벤트에 결제수단 차원 추가',
          rationale: '결제수단별 실패율을 좌표로 관측하기 위해',
        }),
      ]),
    );
  });

  it('결정 문서는 대상 spec에 링크되어 검증을 통과하고, 없는 대상으로는 링크할 수 없다', () => {
    const registry = new MemoryDefinitionRegistry();
    const common = { lifecycle: 'approved' as const, createdAt: NOW, updatedAt: NOW };
    registry.register({
      ...common,
      id: 'order-event-spec',
      title: '주문 이벤트',
      level: 'group',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'overview',
    });
    registry.register({
      ...common,
      id: 'decision-order-payment-dim',
      title: '결제수단 차원 추가 결정',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'specification',
    });
    registry.link('order-event-spec', 'decision-order-payment-dim', 'contains');
    registry.link('decision-order-payment-dim', 'order-event-spec', 'traces_to');

    const result = validateGraph(registry);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);

    expect(() => registry.link('decision-order-payment-dim', 'missing-spec', 'traces_to')).toThrow(
      /도착 문서 미등록/,
    );
  });
});
