// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { describe, expect, it } from 'vitest';
import {
  buildGraphRetentionFailureLog,
  buildGraphRetentionGraphLog,
  buildGraphRetentionSweepLog,
} from './graph-retention-event.js';

describe('graph-retention-event', () => {
  it('builds sweep event logs for ingest forwarding', () => {
    const log = buildGraphRetentionSweepLog({
      trigger: 'api',
      keepLatest: 1,
      graphCount: 2,
      beforeCount: 4,
      afterCount: 2,
      deletedSnapshotIds: ['s1', 's3'],
      graphIds: ['g1', 'g2'],
    });

    expect(log.eventKey).toBe('sim.graph_retention.sweep');
    expect(log.addressContext).toMatchObject({
      service: 'service:v1:sim-audit-browser-api',
      housekeeping: 'housekeeping:v1:graph-retention',
    });
  });

  it('builds single-graph prune event logs', () => {
    const log = buildGraphRetentionGraphLog({
      trigger: 'api',
      graphId: 'consultant-graph-1',
      keepLatest: 1,
      beforeCount: 3,
      afterCount: 1,
      deletedSnapshotIds: ['s1', 's2'],
      keptSnapshotIds: ['s3'],
    });

    expect(log.eventKey).toBe('sim.graph_retention.graph_pruned');
    expect(log.addressContext).toMatchObject({
      graph: 'authorization_graph:v1:consultant-graph-1',
    });
  });

  it('builds failure event logs', () => {
    const log = buildGraphRetentionFailureLog({
      trigger: 'interval',
      keepLatest: 2,
      error: 'db timeout',
    });

    expect(log.eventKey).toBe('sim.graph_retention.failed');
    expect(log.error).toBe('db timeout');
  });
});
