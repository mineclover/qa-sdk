// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * record-operation — DKG에 의사결정/관측을 기록하는 skill.
 *
 * 순수 함수: 노드 + 엣지를 구성하여 반환한다. 그래프 변경은 호출자가 수행.
 */

import type { GraphRegistry } from '../graph-registry.js';
import type {
  DecisionNode,
  DecisionType,
  ObservationNode,
  ObservationSuggestion,
  DecisionScaffoldParams,
} from '../dkg.types.js';
import { scaffoldDecision } from './decision-scaffold.js';

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface RecordDecisionInput {
  readonly targetId: string;
  readonly type: DecisionType;
  readonly title: string;
  readonly rationale: string;
  readonly alternatives?: readonly string[];
  readonly date?: string;
}

export interface RecordDecisionResult {
  readonly verdict: 'ok' | 'blocked';
  readonly reason?: string;
  readonly decision: DecisionNode | null;
  readonly edges: readonly { type: 'governs'; from: string; to: string }[];
  readonly summary: string;
}

export interface RecordObservationInput {
  readonly targetId: string;
  readonly finding: string;
  readonly suggestion?: ObservationSuggestion;
  readonly date?: string;
}

export interface RecordObservationResult {
  readonly verdict: 'ok' | 'blocked';
  readonly reason?: string;
  readonly observation: ObservationNode | null;
  readonly edges: readonly { type: 'observes'; from: string; to: string }[];
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  recordDecision
// ═══════════════════════════════════════════════════════════════

const VALID_TYPES: readonly DecisionType[] = [
  'capacity',
  'new-axis',
  'new-prefix',
  'dim-add',
  'merge',
  'deprecate',
];

export function recordDecision(
  graph: GraphRegistry,
  input: RecordDecisionInput,
): RecordDecisionResult {
  // 대상 존재 확인
  if (!graph.hasNode(input.targetId)) {
    return {
      verdict: 'blocked',
      reason: `대상 노드 없음: ${input.targetId}`,
      decision: null,
      edges: [],
      summary: `대상 노드 없음: ${input.targetId}`,
    };
  }

  if (!VALID_TYPES.includes(input.type)) {
    return {
      verdict: 'blocked',
      reason: `유효하지 않은 type: ${input.type}`,
      decision: null,
      edges: [],
      summary: `유효하지 않은 type: ${input.type} (가능: ${VALID_TYPES.join(', ')})`,
    };
  }

  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const id = `DEC-${input.type.toUpperCase()}-${input.targetId}-${Date.now().toString(36)}`;

  const decision = scaffoldDecision({
    type: input.type,
    id,
    date,
    title: input.title,
    rationale: input.rationale,
    params: buildParams(input.type, input.targetId),
    additionalAlternatives: input.alternatives,
  });

  return {
    verdict: 'ok',
    decision,
    edges: [{ type: 'governs', from: decision.id, to: input.targetId }],
    summary: `${decision.id}: ${decision.title}`,
  };
}

function buildParams(type: DecisionType, target: string): DecisionScaffoldParams {
  switch (type) {
    case 'capacity':
      return { axis: target, currentUsed: 0, currentCapacity: 0, proposedCapacity: 0 };
    case 'new-axis':
      return { axisId: target, entries: [], capacity: 32 };
    case 'new-prefix':
      return { prefixId: target, dims: [] };
    case 'dim-add':
      return { prefix: target, newDim: '' };
    case 'merge':
      return { targets: [target], into: target };
    case 'deprecate':
      return { target };
  }
}

// ═══════════════════════════════════════════════════════════════
//  recordObservation
// ═══════════════════════════════════════════════════════════════

export function recordObservation(
  graph: GraphRegistry,
  input: RecordObservationInput,
): RecordObservationResult {
  // 대상 존재 확인
  if (!graph.hasNode(input.targetId)) {
    return {
      verdict: 'blocked',
      reason: `대상 노드 없음: ${input.targetId}`,
      observation: null,
      edges: [],
      summary: `대상 노드 없음: ${input.targetId}`,
    };
  }

  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const id = `OBS-MANUAL-${input.targetId}-${Date.now().toString(36)}`;

  const observation: ObservationNode = {
    kind: 'observation',
    id,
    date,
    source: 'manual',
    subjects: [input.targetId],
    finding: input.finding,
    suggestion: input.suggestion,
  };

  return {
    verdict: 'ok',
    observation,
    edges: [{ type: 'observes', from: observation.id, to: input.targetId }],
    summary: `${observation.id}: ${observation.finding}`,
  };
}
