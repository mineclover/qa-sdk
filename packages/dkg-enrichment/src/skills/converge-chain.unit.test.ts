// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import type { Catalog } from '@qa-sdk/core';
import { GraphRegistry, deriveFromCatalog } from 'dkg';
import { convergeChain } from './converge-chain.js';

/** channel·initiator는 entries가 같고 서로 다른 prefix에서 쓰인다 → 병합 후보 */
const CATALOG: Catalog = {
  id: 'test',
  name: 'test',
  axes: {
    channel: { id: 'channel', name: 'Channel', versions: { v1: { entries: ['web', 'mobile'] } } },
    initiator: {
      id: 'initiator',
      name: 'Initiator',
      versions: { v1: { entries: ['web', 'mobile'] } },
    },
  },
  prefixes: {
    page_view: {
      id: 'page_view',
      name: 'Page View',
      labels: ['channel'],
      dims: { channel: { kind: 'axis', axisId: 'channel' } },
      versions: [{ version: 'v1', axisVersions: { channel: 'v1' } }],
    },
    click: {
      id: 'click',
      name: 'Click',
      labels: ['initiator'],
      dims: { initiator: { kind: 'axis', axisId: 'initiator' } },
      versions: [{ version: 'v1', axisVersions: { initiator: 'v1' } }],
    },
  },
};

/** 같은 entries의 두 축이 한 prefix의 서로 다른 차원 → 병합이 아니라 이름 정리(alias) 대상 */
const SAME_PREFIX_CATALOG: Catalog = {
  ...CATALOG,
  prefixes: {
    page_view: {
      id: 'page_view',
      name: 'Page View',
      labels: ['channel', 'initiator'],
      dims: {
        channel: { kind: 'axis', axisId: 'channel' },
        initiator: { kind: 'axis', axisId: 'initiator' },
      },
      versions: [{ version: 'v1', axisVersions: { channel: 'v1', initiator: 'v1' } }],
    },
  },
};

describe('convergeChain', () => {
  it('detects merge candidates from overlapping axis entries', () => {
    // convergence 분석기는 DKG의 axis·prefix 관계를 본다 — catalog에서 파생한 graph를 쓴다
    const graph = deriveFromCatalog(CATALOG);

    const result = convergeChain(CATALOG, graph, null);

    expect(result.summary.merges).toBe(1);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({ kind: 'merge', targets: ['channel', 'initiator'] }),
    );
    expect(result.decisions[0]?.id).toBe('DEC-MERGE-channel-initiator');
  });

  it('같은 prefix의 두 차원은 병합하지 않는다 (convergence: alias 판정)', () => {
    const result = convergeChain(SAME_PREFIX_CATALOG, deriveFromCatalog(SAME_PREFIX_CATALOG), null);
    expect(result.summary.merges).toBe(0);
  });

  it('suppresses merge candidates with an active separation decision', () => {
    const graph = deriveFromCatalog(CATALOG);
    graph.addNode({
      kind: 'decision',
      id: 'DEC-SEP-channel-initiator',
      date: '2026-06-18',
      title: '분리 유지',
      context: 'test',
      rationale: '도메인 의미가 다름',
      lifecycle: 'active',
    });

    const result = convergeChain(CATALOG, graph, null);

    expect(result.summary.merges).toBe(0);
    expect(result.decisions).toHaveLength(0);
  });
});
