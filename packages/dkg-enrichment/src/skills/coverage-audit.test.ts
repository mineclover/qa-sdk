// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import type { Catalog } from '@qa-sdk/core';
import { GraphRegistry } from 'dkg';
import { auditCoverage } from './coverage-audit.js';

const CATALOG: Catalog = {
  id: 'test',
  name: 'test',
  axes: {
    action: {
      id: 'action',
      name: 'Action',
      versions: { v1: { entries: ['view', 'click', 'submit'] } },
    },
  },
  prefixes: {
    page_event: {
      id: 'page_event',
      name: 'Page Event',
      labels: ['action'],
      dims: { action: { kind: 'axis', axisId: 'action' } },
      versions: [{ version: 'v1', axisVersions: { action: 'v1' } }],
    },
  },
};

describe('auditCoverage', () => {
  it('reports dormant entries and creates low-coverage observations', () => {
    const graph = new GraphRegistry();
    graph.addNode({ kind: 'prefix', id: 'page_event', name: 'Page Event', dimLabels: ['action'] });

    const result = auditCoverage(
      CATALOG,
      graph,
      [{ axisId: 'action', entry: 'view', count: 3, lastSeen: '2026-06-18T00:00:00.000Z' }],
      [{ prefix: 'page_event', version: 'v1', address: 0, count: 3 }],
      { date: '2026-06-18', lowCoverageThreshold: 0.5 },
    );

    expect(result.report.overallCoverageRate).toBe(1 / 3);
    expect(result.report.dormantCount).toBe(2);
    expect(result.observations.map((obs) => obs.id)).toContain('OBS-COV-page_event');
    expect(result.decisions.map((decision) => decision.id)).toContain('DEC-COV-page_event');
    expect(graph.getNode('OBS-COV-page_event')).toBeDefined();
  });

  it('reports phantom entries without treating them as catalog coverage', () => {
    const graph = new GraphRegistry();

    const result = auditCoverage(
      CATALOG,
      graph,
      [{ axisId: 'action', entry: 'hover', count: 1, lastSeen: '2026-06-18T00:00:00.000Z' }],
      [],
      { date: '2026-06-18' },
    );

    expect(result.report.overallCoverageRate).toBe(0);
    expect(result.report.phantomCount).toBe(1);
    expect(result.report.allEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ axisId: 'action', entry: 'hover', status: 'phantom' }),
      ]),
    );
    expect(result.observations.map((obs) => obs.id)).toContain('OBS-COV-PHANTOM');
  });
});
