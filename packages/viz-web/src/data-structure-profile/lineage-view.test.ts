import { describe, expect, test } from 'vitest';
import type { CompiledLineage, MeasurementReport, ValidationReport } from 'data-structure-profile';
import {
  dataStructureLineageToD3,
  dataStructureLineageToMermaid,
  dataStructureLineageToSvg,
  summarizeDataStructureLineage,
} from './lineage-view.js';

const lineage: CompiledLineage = {
  kind: 'data-structure-profile.compiled.v1',
  profile: 'order-events-to-order-item-facts',
  taxonomyRef: 'data-structure-profile@draft',
  lineage: {
    nodes: [
      {
        id: 'commerce-orders-topic',
        kind: 'source',
        label: 'commerce.orders.v1',
        taxonomyRef: 'data-source-kind:kafka',
      },
      {
        id: 'order-event',
        kind: 'event',
        label: 'Order event',
        taxonomyRef: 'structure-kind:event',
      },
      {
        id: 'item-array',
        kind: 'array',
        label: '$.items[*]',
        taxonomyRef: 'structure-kind:array',
      },
      {
        id: 'explode-items',
        kind: 'transform',
        label: 'explode items',
        taxonomyRef: 'transform-kind:explode',
      },
      {
        id: 'project-order-item-fields',
        kind: 'transform',
        label: 'project order item fields',
        taxonomyRef: 'transform-kind:project',
      },
      {
        id: 'order-item-fact',
        kind: 'fact',
        label: 'analytics.fact_order_items',
        taxonomyRef: 'structure-kind:fact',
      },
    ],
    edges: [
      { from: 'commerce-orders-topic', to: 'order-event', kind: 'emits' },
      { from: 'order-event', to: 'item-array', kind: 'contains' },
      { from: 'item-array', to: 'explode-items', kind: 'input' },
      { from: 'explode-items', to: 'project-order-item-fields', kind: 'feeds' },
      { from: 'project-order-item-fields', to: 'order-item-fact', kind: 'produces' },
    ],
  },
  diagnosticTargets: {
    'event-id-dedup-required': 'source.event_id_path',
    'replay-policy-required': 'source.replay_policy',
    'schema-drift-watch': 'source.schema_ref',
    'array-explosion-budget': 'transforms.explode-items.semantics.max_array_length',
    'dsp-privacy-dpm-ref-missing': 'privacy.dpm_policy_ref',
  },
};

const validation: ValidationReport = {
  kind: 'data-structure-profile.validation-report.v1',
  profile: 'order-events-to-order-item-facts',
  status: 'needs-review',
  summary: { errors: 0, warnings: 1, infos: 0 },
  checkedGates: [
    {
      id: 'array-explosion-budget',
      risk: 'array-explosion',
      severity: 'error',
      result: 'pass',
      evidence: 'max_array_length=200',
    },
    {
      id: 'privacy-readiness',
      risk: 'pii-leak',
      severity: 'warning',
      result: 'warn',
      evidence: 'privacy.dpm_policy_ref',
    },
  ],
  diagnostics: [
    {
      code: 'dsp-privacy-dpm-ref-missing',
      severity: 'warning',
      target: 'privacy.dpm_policy_ref',
      message: 'Sensitive paths exist but no DPM policy reference is declared.',
    },
  ],
};

const measurement: MeasurementReport = {
  kind: 'data-structure-profile.measurement-report.v1',
  profile: 'order-events-to-order-item-facts',
  inputs: {
    expectedEventRatePerSec: 1000,
    averagePayloadBytes: 2048,
    averageArrayLength: 5,
    maxArrayLength: 200,
    estimatedFactRowBytes: 256,
  },
  estimates: {
    rowMultiplier: 5,
    estimatedFactRowsPerSec: 5000,
    estimatedOutputBytesPerSec: 1280000,
    estimatedDailyFactRows: 432000000,
  },
  thresholds: { maxRowMultiplier: 50 },
  warnings: [],
};

describe('Data Structure Profile lineage visualization', () => {
  test('summarizes lineage, diagnostics, and measurement estimates', () => {
    expect(summarizeDataStructureLineage(lineage, validation, measurement)).toEqual({
      profile: 'order-events-to-order-item-facts',
      sources: 1,
      structures: 3,
      transforms: 2,
      facts: 1,
      edges: 5,
      diagnostics: { errors: 0, warnings: 1, infos: 0 },
      rowMultiplier: 5,
      estimatedFactRowsPerSec: 5000,
    });
  });

  test('projects diagnostics onto inspectable D3 nodes', () => {
    const graph = dataStructureLineageToD3(lineage, validation, measurement);

    expect(graph.nodes).toHaveLength(6);
    expect(graph.edges).toHaveLength(5);
    expect(graph.nodes.find((node) => node.id === 'commerce-orders-topic')?.diagnostics).toEqual([
      {
        code: 'dsp-privacy-dpm-ref-missing',
        severity: 'warning',
        target: 'privacy.dpm_policy_ref',
        message: 'Sensitive paths exist but no DPM policy reference is declared.',
      },
    ]);
    expect(graph.edges[0]).toMatchObject({
      id: 'commerce-orders-topic->order-event:emits',
      source: 'commerce-orders-topic',
      target: 'order-event',
      kind: 'emits',
    });
    expect(graph.measurement).toMatchObject({
      rowMultiplier: 5,
      estimatedFactRowsPerSec: 5000,
    });
  });

  test('renders deterministic Mermaid and SVG previews', () => {
    const mermaid = dataStructureLineageToMermaid(lineage, validation);
    const svg = dataStructureLineageToSvg(lineage, validation, measurement);

    expect(mermaid).toContain('flowchart LR');
    expect(mermaid).toContain('commerce_orders_topic["commerce.orders.v1');
    expect(mermaid).toContain('commerce_orders_topic -->|emits| order_event');
    expect(mermaid).toContain('class commerce_orders_topic diagnostic_warning');

    expect(svg).toContain('<svg');
    expect(svg).toContain('data-node-id="commerce-orders-topic"');
    expect(svg).toContain('dsp-privacy-dpm-ref-missing');
    expect(svg).toContain('5,000 facts/sec');
  });
});
