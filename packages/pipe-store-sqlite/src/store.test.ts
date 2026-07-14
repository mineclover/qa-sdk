// @def.boundary persistence-system-root
// @def.doc persistence-system-root

// @def.doc pipe-store-sqlite
import { describe, it, expect, beforeEach } from 'vitest';
import { SqlitePipeGraphStore, SqlitePipeSpecStore, createStores } from './store.js';
import type { PipeSpec, PipeGraph, PipeFlow } from '@qa-sdk/core';

// ── 헬퍼 ──────────────────────────────────────────────

const step = (facet = '소비'): PipeFlow => ({ kind: 'step', facet });

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId: id,
    version: '1.0.0',
    trigger: { eventKey: `${id}_trigger` },
    flow: step(),
    ...overrides,
  };
}

function makeGraph(id: string, version: string, pipes?: PipeSpec[]): PipeGraph {
  const p = pipes ?? [makePipe('p1'), makePipe('p2')];
  return {
    graphId: id,
    version,
    pipes: p,
    connections: [{ from: 'p1', to: 'p2', kind: 'next' as const }],
    entryPipeId: p[0].pipeId,
  };
}

// ── SqlitePipeGraphStore ────────────────────────────

describe('SqlitePipeGraphStore', () => {
  let store: SqlitePipeGraphStore;

  beforeEach(() => {
    store = new SqlitePipeGraphStore(':memory:');
  });

  it('save + get', () => {
    const graph = makeGraph('g1', '1.0.0');
    store.save(graph);
    const loaded = store.get('g1', '1.0.0');

    expect(loaded).not.toBeNull();
    expect(loaded!.graphId).toBe('g1');
    expect(loaded!.pipes).toHaveLength(2);
    expect(loaded!.connections).toHaveLength(1);
    expect(loaded!.entryPipeId).toBe('p1');
  });

  it('save 덮어쓰기', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '1.0.0', [makePipe('p3')]));
    const loaded = store.get('g1', '1.0.0');

    expect(loaded!.pipes).toHaveLength(1);
    expect(loaded!.pipes[0].pipeId).toBe('p3');
  });

  it('getLatest', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '2.0.0'));
    store.save(makeGraph('g1', '1.5.0'));

    const latest = store.getLatest('g1');
    expect(latest!.version).toBe('2.0.0');
  });

  it('listVersions', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '2.0.0'));
    store.save(makeGraph('g2', '1.0.0'));

    const versions = store.listVersions('g1');
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe('1.0.0');
    expect(versions[1].version).toBe('2.0.0');
  });

  it('listAll — 각 graphId의 최신 버전만', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '2.0.0'));
    store.save(makeGraph('g2', '1.0.0'));

    const all = store.listAll();
    expect(all).toHaveLength(2);
    const ids = all.map((g) => `${g.graphId}:${g.version}`);
    expect(ids).toContain('g1:2.0.0');
    expect(ids).toContain('g2:1.0.0');
  });

  it('remove', () => {
    store.save(makeGraph('g1', '1.0.0'));
    expect(store.remove('g1', '1.0.0')).toBe(true);
    expect(store.get('g1', '1.0.0')).toBeNull();
    expect(store.remove('g1', '1.0.0')).toBe(false);
  });

  it('findByPipeId', () => {
    store.save(makeGraph('g1', '1.0.0', [makePipe('target')]));
    store.save(makeGraph('g2', '1.0.0'));

    const found = store.findByPipeId('target');
    expect(found).toHaveLength(1);
    expect(found[0].graphId).toBe('g1');
  });

  it('findByTriggerEvent', () => {
    store.save(
      makeGraph('g1', '1.0.0', [makePipe('p1', { trigger: { eventKey: 'order.created' } })]),
    );
    store.save(makeGraph('g2', '1.0.0'));

    const found = store.findByTriggerEvent('order.created');
    expect(found).toHaveLength(1);
    expect(found[0].graphId).toBe('g1');
  });

  it('존재하지 않는 키 → null', () => {
    expect(store.get('no', '1.0.0')).toBeNull();
    expect(store.getLatest('no')).toBeNull();
  });

  it('PipeFlow JSON 라운드트립 (29종 포함)', () => {
    const graph = makeGraph('g1', '1.0.0', [
      makePipe('p1', {
        flow: {
          kind: 'sequence',
          steps: [
            step('소비'),
            { kind: 'branch', condition: 'x', paths: [step('생산'), step('관리')] },
            { kind: 'retry', step: step('저장'), maxAttempts: 3 },
          ],
        },
      }),
    ]);
    store.save(graph);
    const loaded = store.get('g1', '1.0.0')!;
    const flow = loaded.pipes[0].flow;

    expect(flow.kind).toBe('sequence');
  });
});

// ── SqlitePipeSpecStore ─────────────────────────────

describe('SqlitePipeSpecStore', () => {
  let store: SqlitePipeSpecStore;

  beforeEach(() => {
    store = new SqlitePipeSpecStore(':memory:');
  });

  it('save + get + getLatest', () => {
    store.save(makePipe('p1', { version: '1.0.0' }));
    store.save(makePipe('p1', { version: '2.0.0' }));

    expect(store.get('p1', '1.0.0')).not.toBeNull();
    expect(store.getLatest('p1')!.version).toBe('2.0.0');
  });

  it('listAll + remove', () => {
    store.save(makePipe('p1'));
    store.save(makePipe('p2'));

    expect(store.listAll()).toHaveLength(2);
    expect(store.remove('p1', '1.0.0')).toBe(true);
    expect(store.listAll()).toHaveLength(1);
  });

  it('scope + aspect 저장/복원', () => {
    store.save(makePipe('p1', { scope: 'feature', aspect: 'func_def' }));
    const loaded = store.get('p1', '1.0.0')!;

    expect(loaded.scope).toBe('feature');
    expect(loaded.aspect).toBe('func_def');
  });

  it('produces 저장/복원', () => {
    store.save(makePipe('p1', { produces: ['event.a', 'event.b'] }));
    const loaded = store.get('p1', '1.0.0')!;

    expect(loaded.produces).toEqual(['event.a', 'event.b']);
  });
});

// ── 필드 완전성 패싯 ─────────────────────────────────

describe('PipeGraph 선택적 필드 패싯', () => {
  let store: SqlitePipeGraphStore;

  beforeEach(() => {
    store = new SqlitePipeGraphStore(':memory:');
  });

  it('description 저장/복원', () => {
    const graph: PipeGraph = { ...makeGraph('g1', '1.0.0'), description: '주문 처리 파이프라인' };
    store.save(graph);
    const loaded = store.get('g1', '1.0.0')!;

    expect(loaded.description).toBe('주문 처리 파이프라인');
  });

  it('description 없으면 undefined/null', () => {
    store.save(makeGraph('g1', '1.0.0'));
    const loaded = store.get('g1', '1.0.0')!;

    expect(loaded.description == null).toBe(true);
  });

  it('동일 ID 다른 버전은 별도 레코드', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '2.0.0'));

    expect(store.get('g1', '1.0.0')).not.toBeNull();
    expect(store.get('g1', '2.0.0')).not.toBeNull();
    expect(store.listVersions('g1')).toHaveLength(2);
  });

  it('remove 후 getLatest는 이전 버전 반환', () => {
    store.save(makeGraph('g1', '1.0.0'));
    store.save(makeGraph('g1', '2.0.0'));
    store.remove('g1', '2.0.0');

    expect(store.getLatest('g1')!.version).toBe('1.0.0');
  });
});

// ── createStores 통합 ───────────────────────────────

describe('createStores — 단일 DB 공유', () => {
  it('5개 store가 같은 DB를 공유', () => {
    const { graphStore, specStore, manifestRegistry, bindingStore, lineageValidationStore, close } =
      createStores(':memory:');

    // graph
    graphStore.save(makeGraph('g1', '1.0.0'));
    expect(graphStore.get('g1', '1.0.0')).not.toBeNull();

    // spec
    specStore.save(makePipe('p1'));
    expect(specStore.get('p1', '1.0.0')).not.toBeNull();

    // manifest
    manifestRegistry.registerPrefix('tracking', 'v1');
    const record = manifestRegistry.getPrefixRecord('tracking', 'v1');
    expect(record.state).toBe('draft');

    // binding
    bindingStore.save({
      schemaId: 'orders',
      prefixId: 'order_route',
      prefixVersion: 'v1',
      columnToAxis: {
        id: { dimLabel: 'orderId' },
      },
    });
    expect(bindingStore.get('orders')?.prefixId).toBe('order_route');

    // lineage validation
    lineageValidationStore.save({
      schemaId: 'orders',
      bound: 1,
      unbound: 0,
      mismatched: 0,
      details: [
        {
          status: 'bound',
          target: { schemaId: 'orders', column: 'id' },
          sources: [{ schemaId: 'raw_orders', column: 'id' }],
        },
      ],
    });
    expect(lineageValidationStore.getLatest('orders')?.bound).toBe(1);

    close();
  });
});
