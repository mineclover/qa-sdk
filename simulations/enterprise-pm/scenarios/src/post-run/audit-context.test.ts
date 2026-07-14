import { describe, expect, it } from 'vitest';
import { summarizeAuditContextComposite } from './audit-context.js';

describe('audit-context', () => {
  it('summarizes audit context with retention insight', () => {
    const text = summarizeAuditContextComposite({
      rootSpanId: 'root-1',
      graphId: 'graph-1',
      trace: { count: 3, entries: [] },
      firstFailure: null,
      graphSnapshot: {
        snapshotId: 'graph-1:002',
        graph: { nodes: [], relations: [], realms: [] },
      },
      graphRetentionInsight: {
        total: 1,
        summary: { 'sim.graph_retention.graph_pruned': 1 },
        byTrigger: { api: 1 },
        byGraphId: { 'graph-1': 1 },
      },
    });

    expect(text).toContain('root=root-1');
    expect(text).toContain('snapshot=graph-1:002');
    expect(text).toContain('sim.graph_retention.graph_pruned=1');
  });
});
