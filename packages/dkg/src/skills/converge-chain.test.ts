// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import type { Catalog } from '@qa-sdk/core';
import { GraphRegistry } from '../graph-registry.js';
import { convergeChain } from './converge-chain.js';

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
    const graph = new GraphRegistry();

    const result = convergeChain(CATALOG, graph, null);

    expect(result.summary.merges).toBe(1);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({ kind: 'merge', targets: ['channel', 'initiator'] }),
    );
    expect(result.decisions[0]?.id).toBe('DEC-MERGE-channel-initiator');
  });

  it('suppresses merge candidates with an active separation decision', () => {
    const graph = new GraphRegistry();
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
