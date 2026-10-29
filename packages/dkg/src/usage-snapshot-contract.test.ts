// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import {
  assertUsageSnapshotContract,
  validateUsageSnapshotContract,
  type UsageSnapshotContract,
  type UsageSnapshotStore,
} from './usage-snapshot-contract.js';

const SNAPSHOT: UsageSnapshotContract = {
  snapshotId: 'usage-snapshot:v1:1',
  catalogId: 'demo',
  digest: `sha256:${'a'.repeat(64)}`,
  idempotencyKey: 'convergence-run-1',
  collectedAt: '2026-10-30T00:00:00.000Z',
  period: {
    from: '2026-10-29T00:00:00.000Z',
    to: '2026-10-30T00:00:00.000Z',
  },
  totalRecords: 3,
  data: {
    entryUsages: [],
    addressUsages: [],
    coOccurrences: [],
    collectionPeriod: {
      from: '2026-10-29T00:00:00.000Z',
      to: '2026-10-30T00:00:00.000Z',
    },
    versionUsages: [],
    sourceStats: {
      totalRecords: 3,
      uniqueTraces: 0,
      uniqueSessions: 0,
      uniqueEventKeys: 0,
      traceIds: [],
      sessionIds: [],
      eventKeys: [],
      byExecutionMode: {},
      byExecutionId: {},
    },
  },
};

describe('UsageSnapshot backend-agnostic contract', () => {
  it('validates identity, digest, period, payload, and source count', () => {
    expect(validateUsageSnapshotContract(SNAPSHOT)).toEqual({ ok: true, issues: [] });
    expect(() => assertUsageSnapshotContract(SNAPSHOT)).not.toThrow();
  });

  it('rejects invalid digest, identity, and negative count', () => {
    const result = validateUsageSnapshotContract({
      ...SNAPSHOT,
      snapshotId: ' ',
      idempotencyKey: '',
      digest: 'md5:bad',
      totalRecords: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'snapshotId',
      'idempotencyKey',
      'digest',
      'totalRecords',
      'data.sourceStats.totalRecords',
    ]);
  });

  it('rejects reversed periods and mismatched payload period', () => {
    const result = validateUsageSnapshotContract({
      ...SNAPSHOT,
      period: { from: SNAPSHOT.period.to, to: SNAPSHOT.period.from },
      data: {
        ...SNAPSHOT.data,
        collectionPeriod: { from: SNAPSHOT.period.from, to: SNAPSHOT.period.to },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'period',
      'data.collectionPeriod.from',
      'data.collectionPeriod.to',
    ]);
  });

  it('keeps sourceStats totalRecords consistent with the logical snapshot', () => {
    const result = validateUsageSnapshotContract({
      ...SNAPSHOT,
      data: { ...SNAPSHOT.data, sourceStats: { ...SNAPSHOT.data.sourceStats!, totalRecords: 2 } },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(['data.sourceStats.totalRecords']);
  });

  it('declares a backend-neutral purpose port without requiring an adapter', () => {
    const port: UsageSnapshotStore = {
      publish: async () => 'created',
      get: async () => SNAPSHOT,
      getByIdempotencyKey: async () => SNAPSHOT,
      latest: async () => SNAPSHOT,
    };
    expect(port).toBeDefined();
  });
});
