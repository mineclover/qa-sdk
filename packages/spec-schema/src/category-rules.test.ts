// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, expect, it } from 'vitest';
import { validatePrefixCategory } from './category-rules.js';
import type { GraphPort, GraphNodeLike, GraphEdgeLike } from './shared/graph-port.js';

function graphFor(
  prefixId: string,
  category: string,
  dimLabels: readonly string[],
  edges: readonly GraphEdgeLike[] = [],
): GraphPort {
  const prefix: GraphNodeLike = { kind: 'prefix', id: prefixId };
  return {
    getNode: (id) => (id === prefixId ? { ...prefix, category, dimLabels } : undefined),
    getNodeOrThrow: () => ({ ...prefix, category, dimLabels }),
    getNodesByKind: () => [prefix],
    getAllNodes: () => [prefix],
    findNodes: () => [prefix],
    edgesFrom: (id, type) =>
      edges.filter((edge) => edge.from === id && (type === undefined || edge.type === type)),
    edgesTo: () => [],
    neighbors: () => [],
    intentLinksFor: () => [],
    cascadeFromAxis: () => [],
    cascadeFromPrefix: () => ({ domains: [], consumers: [] }),
    activeConstraints: () => [],
    getPrefixesByCategory: () => [prefix],
    groupPrefixesByCategory: () => ({ [category]: [prefix] }),
    nodeCount: 1,
    edgeCount: edges.length,
    addNode: () => undefined,
    addEdge: () => undefined,
  };
}

describe('category rules', () => {
  it('treats call-kind as an action axis for event prefixes', () => {
    const result = validatePrefixCategory(
      'ir_pipe',
      graphFor(
        'ir_pipe',
        'event',
        ['svc_ref', 'ir_pipe_state', 'ir_call_kind'],
        [
          { type: 'composes', from: 'ir_pipe', to: 'ir_pipe_state', meta: { dimKind: 'axis' } },
          { type: 'composes', from: 'ir_pipe', to: 'ir_call_kind', meta: { dimKind: 'axis' } },
        ],
      ),
    );

    expect(result.valid).toBe(true);
  });

  it('allows ModuleIR as a definition-space self observation', () => {
    const result = validatePrefixCategory(
      'ir_module',
      graphFor('ir_module', 'observation', ['def_level', 'def_layer', 'ir_certainty']),
    );

    expect(result.valid).toBe(true);
  });
});
