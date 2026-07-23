// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from 'vitest';
import { createContextBudgetProfile } from 'context-runtime';
import type { TaskHandoff } from 'context-runtime';
import type { DefDoc } from 'definition-catalog';
import {
  buildBoundedDefinitionContext,
  executeDefinitionTaskDecomposition,
  executeDefinitionTaskDecompositionWithDiscovery,
} from './definition-document-context.js';
import { createProviderTokenCounter } from './provider-usage-adapters.js';

const document: DefDoc = {
  docId: 'definition-addressing',
  title: 'Definition Addressing',
  scope: 'system',
  aspect: 'architecture',
  depth: 'overview',
  lifecycle: 'approved',
  tags: ['context'],
  links: [],
  version: 1,
  revision: 1,
  address: 'def_document:v2:342161',
};

function createCountingSource() {
  return {
    get: vi.fn(async () => document),
    getBody: vi.fn(async () => ({
      docId: document.docId,
      body: 'authoritative definition body',
      revision: document.revision,
    })),
    getBoundaryContext: vi.fn(async () => ({
      mode: 'transitive' as const,
      level: 'overview' as const,
      boundary: {
        boundary: { docId: document.docId, title: document.title!, lifecycle: 'approved' },
        members: [],
        couplings: { outgoing: [], incoming: [] },
      },
      concerns: { docId: document.docId, direct: [], inherited: [], all: [] },
      impact: {
        sourceId: document.docId,
        impacted: [],
        affectedGroups: [],
        blastRadius: 0,
        byLayer: { domain: 0, operation: 0, mediation: 0, experience: 0, unspecified: 0 },
      },
      feedbackTrace: [],
    })),
    getChildren: vi.fn(async () => []),
    getIncomingLinks: vi.fn(async () => []),
    getOutgoingLinks: vi.fn(async () => []),
  };
}

describe('bounded definition context source resolution', () => {
  it('[contract:docs-control-plane.definition-context.lazy-resolution.v1] does not read optional source payloads when discovery is capped', async () => {
    const source = createCountingSource();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      usedTokens: 100_000,
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.discovery.selectedRouteKeys).toEqual([]);
    expect(result.workingContext.status).toBe('blocked');
    expect(source.get).not.toHaveBeenCalled();
    expect(source.getBody).not.toHaveBeenCalled();
    expect(source.getBoundaryContext).not.toHaveBeenCalled();
  });

  it('[contract:docs-control-plane.definition-context.lazy-resolution.v1] resolves only selected routes after freeze', async () => {
    const source = createCountingSource();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 2 }),
      requiredFactKeys: ['definition.document'],
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.discovery.selectedRouteKeys).toEqual([
      'definition.boundary-context.summary',
      'definition.document.authoritative',
    ]);
    expect(result.workingContext.status).toBe('closed');
    expect(source.get).not.toHaveBeenCalled();
    expect(source.getBoundaryContext).not.toHaveBeenCalled();
    expect(source.getBody).not.toHaveBeenCalled();
  });

  it('[contract:docs-control-plane.definition-context.observation-sink.v1] delivers metadata observation through an optional sink', async () => {
    const source = createCountingSource();
    const sink = vi.fn();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 2 }),
      requiredFactKeys: ['definition.document'],
      observationSink: sink,
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(result.observation);
    expect(sink.mock.calls[0]?.[0]).not.toHaveProperty('factValues');
    expect(sink.mock.calls[0]?.[0]).not.toHaveProperty('body');
  });

  it('[contract:docs-control-plane.definition-context.usage-accounting.v1] exposes measured phase usage and blocks working overrun', async () => {
    const source = createCountingSource();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      tokenCounter: {
        measurement: 'measured',
        count: (value) =>
          typeof value === 'object' && value !== null && 'route' in value ? 1 : 40_000,
      },
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.usage.workingTokens).toBe(120_000);
    expect(result.usage.measurement).toBe('mixed');
    expect(result.workingContext.status).toBe('blocked');
    expect(result.workingContext.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'working-budget-exhausted', factKey: '$context' }),
      ]),
    );
    expect(result.observation.usage).toMatchObject({
      workingTokens: 120_000,
      totalTokens: expect.any(Number),
    });
  });

  it('[contract:docs-control-plane.definition-context.usage-accounting.v1] shares the injected counter with Discovery and Working', async () => {
    const source = createCountingSource();
    const countContexts: Array<{ phase: string; routeKey?: string; factKey?: string }> = [];

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 2 }),
      requiredFactKeys: ['definition.document'],
      usedTokensMeasurement: 'measured',
      tokenCounter: createProviderTokenCounter({
        provider: 'openai',
        model: 'gpt-test',
        tokenizerRevision: 'fixture-v1',
        count: (_value, context) => {
          if (context) countContexts.push(context);
          return 1;
        },
      }),
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.discovery.projections).toEqual(
      expect.arrayContaining([expect.objectContaining({ costMeasurement: 'measured' })]),
    );
    expect(
      result.usage.events
        .filter((event) => event.phase === 'discovery' || event.phase === 'working')
        .every((event) => event.measurement === 'measured'),
    ).toBe(true);
    expect(result.usage.measurement).toBe('measured');
    expect(countContexts.map((context) => context.phase)).toEqual(
      expect.arrayContaining(['discovery', 'working']),
    );
    expect(countContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: 'discovery', routeKey: expect.any(String) }),
        expect.objectContaining({
          phase: 'working',
          routeKey: 'definition.document.authoritative',
          factKey: 'definition.document',
        }),
      ]),
    );
    expect(result.usage.events.filter((event) => event.measurement === 'measured')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-test',
          tokenizerRevision: 'fixture-v1',
        }),
      ]),
    );
  });

  it('[contract:docs-control-plane.definition-context.usage-accounting.v1] emits an EventRecord-compatible metadata projection', async () => {
    const source = createCountingSource();
    const eventSink = vi.fn();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 2 }),
      requiredFactKeys: ['definition.document'],
      tokenCounter: {
        measurement: 'measured',
        count: () => 1,
      },
      observationEventSink: eventSink,
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.workingContext.status).toBe('closed');
    expect(eventSink).toHaveBeenCalledOnce();
    expect(eventSink).toHaveBeenCalledWith(result.observationEvent);
    expect(eventSink.mock.calls[0]?.[0]).toMatchObject({
      event_key: 'context_runtime_observation',
      event_version: '1',
      timestamp: '2026-07-23T00:00:00.000Z',
      address_context: { def_document: document.address },
      payload: {
        task_key: result.task.taskKey,
        stage: 'working',
        status: 'closed',
        fact_count: 1,
        working_tokens: 1,
      },
    });
    expect(JSON.stringify(eventSink.mock.calls[0]?.[0])).not.toContain(
      'authoritative definition body',
    );
  });

  it('[contract:docs-control-plane.definition-context.graph-discovery.v1] discovers bounded graph candidates from source metadata', async () => {
    const source = createCountingSource();
    source.getChildren.mockResolvedValue([
      { ...document, docId: 'definition-child', title: 'Child Definition' },
    ]);
    source.getIncomingLinks.mockResolvedValue([{ source: 'definition-parent', type: 'contains' }]);
    source.getOutgoingLinks.mockResolvedValue([
      { target: 'definition-contract', type: 'depends_on' },
    ]);

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 3 }),
      requiredFactKeys: ['definition.document'],
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(source.getChildren).toHaveBeenCalledWith(document.docId);
    expect(source.getIncomingLinks).toHaveBeenCalledWith(document.docId);
    expect(source.getOutgoingLinks).toHaveBeenCalledWith(document.docId);
    expect(result.discovery.projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeKey: 'definition.graph.outgoing.depends_on.definition-contract',
          sourceRef: 'definition:definition-contract',
        }),
      ]),
    );
    expect(result.discovery.projections).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ routeKey: expect.stringContaining('body') }),
      ]),
    );
    expect(result.workingContext.status).toBe('closed');
  });

  it('[contract:docs-control-plane.definition-context.minimum-working-facts.v1] blocks when the default minimum facts cannot be resolved', async () => {
    const source = createCountingSource();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      budget: createContextBudgetProfile({ maxRouteExpansions: 2 }),
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.workingContext.status).toBe('blocked');
    expect(result.manifest).toBeUndefined();
    expect(result.workingContext.facts).toEqual([]);
    expect(result.workingContext.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'route-not-selected',
          factKey: 'definition.boundary-context',
        }),
        expect.objectContaining({ code: 'route-not-selected', factKey: 'definition.body' }),
      ]),
    );
    expect(source.getBoundaryContext).not.toHaveBeenCalled();
    expect(source.getBody).not.toHaveBeenCalled();
  });

  it('[contract:docs-control-plane.definition-context.usage-accounting.v1] accepts a prior usage snapshot as the discovery budget input', async () => {
    const source = createCountingSource();

    const result = await buildBoundedDefinitionContext({
      source,
      document,
      docId: document.docId,
      initialUsage: {
        events: [
          { phase: 'discovery', tokens: 99_999, measurement: 'measured', sourceRef: 'prior-task' },
        ],
        discoveryTokens: 99_999,
        workingTokens: 0,
        totalTokens: 99_999,
        measurement: 'measured',
      },
      now: '2026-07-23T00:00:00.000Z',
    });

    expect(result.discovery.selectedRouteKeys).toEqual([]);
    expect(result.discovery.nextAction).toBe('decompose');
    expect(result.usage.discoveryTokens).toBe(99_999);
    expect(source.getBody).not.toHaveBeenCalled();
    expect(source.getBoundaryContext).not.toHaveBeenCalled();
  });

  it('[contract:docs-control-plane.definition-context.usage-accounting.v1] rejects a prior usage snapshot whose totals disagree with its events', async () => {
    const source = createCountingSource();

    await expect(
      buildBoundedDefinitionContext({
        source,
        document,
        docId: document.docId,
        initialUsage: {
          events: [
            { phase: 'discovery', tokens: 10, measurement: 'measured', sourceRef: 'prior-task' },
          ],
          discoveryTokens: 99_999,
          workingTokens: 0,
          totalTokens: 99_999,
          measurement: 'measured',
        },
        now: '2026-07-23T00:00:00.000Z',
      }),
    ).rejects.toThrow('initialUsage summary');
  });

  it('[contract:docs-control-plane.definition-context.handoff-execution.v1] aggregates only fully completed child Handoffs', async () => {
    const decomposition = {
      parentTaskKey: 'definition-context:parent',
      reason: 'budget-exhausted' as const,
      children: [
        {
          taskKey: 'definition-context:parent/discovery/a',
          objective: 'Inspect route a',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['route.a'],
          estimatedCostTokens: 10,
          estimatedObjectCount: 1,
          estimatedRelationCount: 1,
        },
        {
          taskKey: 'definition-context:parent/discovery/b',
          objective: 'Inspect route b',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['route.b'],
          estimatedCostTokens: 10,
          estimatedObjectCount: 1,
          estimatedRelationCount: 1,
        },
      ],
    };
    const executeChild = async (
      task: (typeof decomposition.children)[number],
    ): Promise<TaskHandoff> => ({
      version: 'v1',
      taskKey: task.taskKey,
      sourceRevision: `source:${task.taskKey}`,
      resultRevision: `result:${task.taskKey}`,
      manifestDigest: `fnv1a64:${task.taskKey}`,
      factRefs: [],
      evidenceRefs: [],
      unresolvedQuestions: [],
    });

    const result = await executeDefinitionTaskDecomposition({
      decomposition,
      executeChild,
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:7',
      unresolvedQuestions: [],
    });

    expect(result.execution.status).toBe('completed');
    expect(result.handoff).toMatchObject({
      taskKey: decomposition.parentTaskKey,
      childTaskKeys: decomposition.children.map((child) => child.taskKey),
    });
  });

  it('[contract:docs-control-plane.definition-context.discovery-result-policy.v1] keeps discovery results outside parent Fact Handoff', async () => {
    const decomposition = {
      parentTaskKey: 'definition-context:mixed-parent',
      reason: 'mixed-cap' as const,
      children: [
        {
          taskKey: 'definition-context:mixed-parent/discovery/graph',
          objective: 'Inspect graph route',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['definition.graph.outgoing.depends_on.contract'],
          estimatedCostTokens: 1_000,
          estimatedObjectCount: 1,
          estimatedRelationCount: 1,
        },
        {
          taskKey: 'definition-context:mixed-parent/discovery/document',
          objective: 'Resolve document route',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['definition.document.authoritative'],
          estimatedCostTokens: 2_000,
          estimatedObjectCount: 1,
          estimatedRelationCount: 0,
        },
      ],
    };

    const result = await executeDefinitionTaskDecompositionWithDiscovery({
      decomposition,
      executeChild: async (task) =>
        task.routeKeys[0]!.startsWith('definition.graph')
          ? {
              taskKey: task.taskKey,
              kind: 'discovery' as const,
              routeKeys: task.routeKeys,
              sourceRefs: ['definition:contract', 'definition:contract'],
              unresolvedQuestions: ['Should the contract be included?'],
            }
          : {
              taskKey: task.taskKey,
              kind: 'handoff' as const,
              routeKeys: task.routeKeys,
              unresolvedQuestions: [],
              handoff: {
                version: 'v1' as const,
                taskKey: task.taskKey,
                sourceRevision: 'source:42',
                resultRevision: 'result:1',
                manifestDigest: 'fnv1a64:child',
                factRefs: [],
                evidenceRefs: [],
                unresolvedQuestions: [],
              },
            },
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:1',
      unresolvedQuestions: [],
    });

    expect(result.execution.status).toBe('completed');
    expect(result.discoveryRefs).toEqual([
      {
        taskKey: 'definition-context:mixed-parent/discovery/graph',
        routeKeys: ['definition.graph.outgoing.depends_on.contract'],
        sourceRefs: ['definition:contract'],
      },
    ]);
    expect(result.handoff?.childTaskKeys).toEqual([
      'definition-context:mixed-parent/discovery/document',
    ]);
    expect(result.handoff?.factRefs).toEqual([]);
    expect(result.unresolvedQuestions).toEqual(['Should the contract be included?']);
  });

  it('[contract:docs-control-plane.definition-context.discovery-result-policy.v1] blocks parent Handoff when a mixed child execution is partial', async () => {
    const decomposition = {
      parentTaskKey: 'definition-context:mixed-parent',
      reason: 'mixed-cap' as const,
      children: [
        {
          taskKey: 'definition-context:mixed-parent/discovery/graph',
          objective: 'Inspect graph route',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['definition.graph.outgoing.depends_on.contract'],
          estimatedCostTokens: 1_000,
          estimatedObjectCount: 1,
          estimatedRelationCount: 1,
        },
        {
          taskKey: 'definition-context:mixed-parent/discovery/document',
          objective: 'Resolve document route',
          anchor: {
            anchorKey: 'definition:parent',
            ref: 'definition:parent',
            kind: 'entity' as const,
          },
          routeKeys: ['definition.document.authoritative'],
          estimatedCostTokens: 2_000,
          estimatedObjectCount: 1,
          estimatedRelationCount: 0,
        },
      ],
    };

    const result = await executeDefinitionTaskDecompositionWithDiscovery({
      decomposition,
      executeChild: async (task) => {
        if (task.routeKeys[0]!.startsWith('definition.graph')) {
          return {
            taskKey: task.taskKey,
            kind: 'discovery' as const,
            routeKeys: task.routeKeys,
            sourceRefs: ['definition:contract'],
            unresolvedQuestions: [],
          };
        }
        throw new Error('document route unavailable');
      },
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:1',
      unresolvedQuestions: [],
    });

    expect(result.execution.status).toBe('partial');
    expect(result.discoveryRefs).toHaveLength(1);
    expect(result.handoff).toBeUndefined();
  });
});
