import { describe, expect, it } from 'vitest';
import { summarizeGraphRetentionInsight } from './graph-retention-insight.js';

describe('graph-retention-insight', () => {
  it('summarizes retention insight counts', () => {
    const text = summarizeGraphRetentionInsight({
      total: 3,
      summary: {
        'sim.graph_retention.sweep': 2,
        'sim.graph_retention.graph_pruned': 1,
      },
      byTrigger: {
        api: 1,
        interval: 2,
      },
      byGraphId: {
        'consultant-graph-1': 1,
        'authorization_graph:v1:all': 2,
      },
      items: [],
    });

    expect(text).toContain('total=3');
    expect(text).toContain('sim.graph_retention.sweep=2');
    expect(text).toContain('interval=2');
  });
});
