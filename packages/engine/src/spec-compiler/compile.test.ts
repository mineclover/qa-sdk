// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import { describe, expect, it } from 'vitest';
import { compileSpec } from './compile.js';
import type { ScenarioSpec, ScenarioStep } from '@qa-sdk/core';

function buildStep(overrides: Partial<ScenarioStep> = {}): ScenarioStep {
  return {
    id: 's1',
    event_key: 'event.one',
    required: true,
    kind: 'sequence',
    ...overrides,
  };
}

function buildSpec(
  overrides: Partial<ScenarioSpec> & { steps?: ScenarioStep[] } = {},
): ScenarioSpec {
  return {
    scenario_id: 'test-scenario',
    version: '1.0.0',
    domain: 'test',
    steps: [buildStep()],
    ...overrides,
  };
}

describe('compileSpec', () => {
  it('projects lightweight spec nodes from steps', () => {
    const constraints = [{ field: 'payload.total', op: 'gt' as const, value: 0 }];
    const spec = buildSpec({
      steps: [
        buildStep({
          id: 's1',
          event_key: 'checkout.start',
          event_version: '002',
          source: 'checkout-api',
          record_kind: 'span',
          constraints,
          timeout_ms: 500,
        }),
        buildStep({ id: 's2', event_key: 'checkout.end' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toEqual({
      step_id: 's1',
      event_key: 'checkout.start',
      event_version: '002',
      source: 'checkout-api',
      record_kind: 'span',
      required: true,
      kind: 'sequence',
      constraints,
      timeout_ms: 500,
    });
    expect(graph.nodes[1]).toEqual({
      step_id: 's2',
      event_key: 'checkout.end',
      required: true,
      kind: 'sequence',
    });
  });

  it('preserves scenario_id and version', () => {
    const graph = compileSpec(buildSpec({ scenario_id: 'sc-1', version: '2.0.0' }));

    expect(graph.scenario_id).toBe('sc-1');
    expect(graph.version).toBe('2.0.0');
  });

  it('creates sequence edges from next array', () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: 's1', next: ['s2', 's3'] }),
        buildStep({ id: 's2' }),
        buildStep({ id: 's3' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { source: 's1', target: 's2', type: 'sequence' },
      { source: 's1', target: 's3', type: 'sequence' },
    ]);
  });

  it('creates optional edges when step kind is optional', () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: 's1', kind: 'optional', required: false, next: ['s2'] }),
        buildStep({ id: 's2' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([{ source: 's1', target: 's2', type: 'optional' }]);
  });

  it('creates branch edges with conditions', () => {
    const condition = { field: 'payload.type', op: 'eq' as const, value: 'premium' };
    const spec = buildSpec({
      steps: [
        buildStep({
          id: 's1',
          kind: 'branch',
          branches: [{ condition, next: ['s2', 's3'] }],
        }),
        buildStep({ id: 's2' }),
        buildStep({ id: 's3' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { source: 's1', target: 's2', type: 'branch', condition },
      { source: 's1', target: 's3', type: 'branch', condition },
    ]);
  });

  it('creates no edges when step has no next or branches', () => {
    const spec = buildSpec({
      steps: [buildStep({ id: 's1' })],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([]);
  });

  it('handles step with both next and branches', () => {
    const condition = { field: 'payload.x', op: 'exists' as const };
    const spec = buildSpec({
      steps: [
        buildStep({
          id: 's1',
          next: ['s2'],
          branches: [{ condition, next: ['s3'] }],
        }),
        buildStep({ id: 's2' }),
        buildStep({ id: 's3' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]).toEqual({ source: 's1', target: 's2', type: 'sequence' });
    expect(graph.edges[1]).toEqual({ source: 's1', target: 's3', type: 'branch', condition });
  });

  it('creates branch edges when step kind is branch and next is used (Gap 4)', () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: 's1', kind: 'branch', next: ['s2', 's3'] }),
        buildStep({ id: 's2' }),
        buildStep({ id: 's3' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { source: 's1', target: 's2', type: 'branch' },
      { source: 's1', target: 's3', type: 'branch' },
    ]);
  });

  it('propagates entry_conditions to SpecGraph', () => {
    const entryConditions = [{ field: 'payload.env', op: 'eq' as const, value: 'prod' }];
    const spec = buildSpec({ entry_conditions: entryConditions });

    const graph = compileSpec(spec);

    expect(graph.entry_conditions).toEqual(entryConditions);
  });

  it('omits entry_conditions from SpecGraph when not defined', () => {
    const spec = buildSpec(); // no entry_conditions

    const graph = compileSpec(spec);

    expect(graph.entry_conditions).toBeUndefined();
  });

  it('handles multiple branches with different conditions', () => {
    const spec = buildSpec({
      steps: [
        buildStep({
          id: 's1',
          kind: 'branch',
          branches: [
            { condition: { field: 'payload.type', op: 'eq' as const, value: 'a' }, next: ['s2'] },
            { condition: { field: 'payload.type', op: 'eq' as const, value: 'b' }, next: ['s3'] },
          ],
        }),
        buildStep({ id: 's2' }),
        buildStep({ id: 's3' }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0].target).toBe('s2');
    expect(graph.edges[1].target).toBe('s3');
  });
});
