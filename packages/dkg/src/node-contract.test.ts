import { describe, expect, it } from 'vitest';
import {
  assertDecisionNode,
  assertObservationNode,
  validateDecisionNode,
  validateObservationNode,
} from './node-contract.js';
import type { DecisionNode, ObservationNode } from './dkg.types.js';

const DECISION: DecisionNode = {
  kind: 'decision',
  id: 'DEC-001',
  date: '2026-10-30',
  title: '스냅샷 계약을 순수 계층에 둔다',
  context: 'storage-contract',
  rationale: 'backend 선택과 데이터 목적을 분리한다',
  lifecycle: 'active',
};

const OBSERVATION: ObservationNode = {
  kind: 'observation',
  id: 'OBS-001',
  date: '2026-10-30',
  source: 'metric',
  subjects: ['catalog_snapshot'],
  finding: 'snapshot digest 계약을 확인했다',
  intent: 'monitoring',
  provenance: {
    producer: 'dkg/node-contract-test',
    producerVersion: '0.1.0',
  },
};

describe('DKG node data contract', () => {
  it('validates decision purpose fields and lifecycle', () => {
    expect(validateDecisionNode(DECISION)).toEqual({ ok: true, issues: [] });
    expect(() => assertDecisionNode(DECISION)).not.toThrow();
  });

  it('rejects incomplete decisions deterministically', () => {
    const result = validateDecisionNode({ ...DECISION, title: '', lifecycle: 'unknown' } as never);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(['title', 'lifecycle']);
  });

  it('validates monitoring observations without requiring resolution', () => {
    expect(validateObservationNode(OBSERVATION)).toEqual({ ok: true, issues: [] });
    expect(() => assertObservationNode(OBSERVATION)).not.toThrow();
  });

  it('requires resolution for action-needed observations', () => {
    const result = validateObservationNode({ ...OBSERVATION, intent: 'action-needed' });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(['resolution']);
  });

  it('checks resolution outcome and decision reference', () => {
    const unresolved = {
      ...OBSERVATION,
      intent: 'completed',
      resolution: { decisionId: 'DEC-MISSING', outcome: 'accepted' },
    } satisfies ObservationNode;
    const result = validateObservationNode(unresolved, { decisionIds: new Set(['DEC-001']) });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(['resolution.decisionId']);

    const resolved = { ...unresolved, resolution: { decisionId: 'DEC-001', outcome: 'accepted' } };
    expect(validateObservationNode(resolved, { decisionIds: new Set(['DEC-001']) }).ok).toBe(true);
  });

  it('requires non-empty observation subjects and finding', () => {
    const result = validateObservationNode({ ...OBSERVATION, subjects: [], finding: ' ' });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(['subjects', 'finding']);
  });
});
