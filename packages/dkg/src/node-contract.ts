// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import type { DecisionNode, ObservationNode } from './dkg.types.js';

/** 순수 DKG node 계약 검증 결과. 저장 backend와 무관하다. */
export interface NodeContractIssue {
  readonly path: string;
  readonly message: string;
}

export interface NodeContractResult {
  readonly ok: boolean;
  readonly issues: readonly NodeContractIssue[];
}

const DECISION_LIFECYCLES = new Set(['active', 'superseded', 'reversed']);
const OBSERVATION_SOURCES = new Set(['runtime', 'review', 'metric', 'manual']);
const OBSERVATION_INTENTS = new Set(['action-needed', 'monitoring', 'completed']);
const RESOLUTION_OUTCOMES = new Set(['accepted', 'deferred', 'rejected']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, path: string, issues: NodeContractIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path, message: '비어 있지 않은 문자열이어야 합니다.' });
  }
}

function validDate(value: unknown, path: string, issues: NodeContractIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: 'ISO 날짜 또는 timestamp 문자열이어야 합니다.' });
  }
}

function validStringArray(value: unknown, path: string, issues: NodeContractIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: '하나 이상의 문자열을 가져야 합니다.' });
    return;
  }
  value.forEach((item, index) => requiredText(item, `${path}[${index}]`, issues));
}

/** DecisionNode의 필수 목적·식별·생명주기 계약을 검증한다. */
export function validateDecisionNode(node: DecisionNode): NodeContractResult {
  const issues: NodeContractIssue[] = [];
  if (!node || typeof node !== 'object') {
    return { ok: false, issues: [{ path: '$', message: '객체여야 합니다.' }] };
  }

  if (node.kind !== 'decision') {
    issues.push({ path: 'kind', message: 'decision이어야 합니다.' });
  }
  requiredText(node.id, 'id', issues);
  validDate(node.date, 'date', issues);
  requiredText(node.title, 'title', issues);
  requiredText(node.context, 'context', issues);
  requiredText(node.rationale, 'rationale', issues);
  if (!DECISION_LIFECYCLES.has(node.lifecycle)) {
    issues.push({ path: 'lifecycle', message: 'active·superseded·reversed 중 하나여야 합니다.' });
  }

  for (const [field, value] of [
    ['alternatives', node.alternatives],
    ['reversalConditions', node.reversalConditions],
  ] as const) {
    if (value !== undefined) {
      if (!Array.isArray(value)) {
        issues.push({ path: field, message: '문자열 배열이어야 합니다.' });
      } else {
        value.forEach((item, index) => requiredText(item, `${field}[${index}]`, issues));
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * ObservationNode의 필수 관측·provenance·resolution 계약을 검증한다.
 * decisionIds를 제공하면 resolution이 실제 DecisionNode를 참조하는지도 확인한다.
 */
export function validateObservationNode(
  node: ObservationNode,
  options?: { readonly decisionIds?: ReadonlySet<string> },
): NodeContractResult {
  const issues: NodeContractIssue[] = [];
  if (!node || typeof node !== 'object') {
    return { ok: false, issues: [{ path: '$', message: '객체여야 합니다.' }] };
  }

  if (node.kind !== 'observation') {
    issues.push({ path: 'kind', message: 'observation이어야 합니다.' });
  }
  requiredText(node.id, 'id', issues);
  validDate(node.date, 'date', issues);
  if (!OBSERVATION_SOURCES.has(node.source)) {
    issues.push({ path: 'source', message: 'runtime·review·metric·manual 중 하나여야 합니다.' });
  }
  validStringArray(node.subjects, 'subjects', issues);
  requiredText(node.finding, 'finding', issues);
  if (node.intent !== undefined && !OBSERVATION_INTENTS.has(node.intent)) {
    issues.push({
      path: 'intent',
      message: 'action-needed·monitoring·completed 중 하나여야 합니다.',
    });
  }

  if (node.provenance !== undefined) {
    if (!isRecord(node.provenance)) {
      issues.push({ path: 'provenance', message: '객체여야 합니다.' });
    } else {
      requiredText(node.provenance.producer, 'provenance.producer', issues);
      requiredText(node.provenance.producerVersion, 'provenance.producerVersion', issues);
      for (const [field, value] of [
        ['algorithmVersion', node.provenance.algorithmVersion],
        ['inputDigest', node.provenance.inputDigest],
        ['catalogDigest', node.provenance.catalogDigest],
      ] as const) {
        if (value !== undefined) requiredText(value, `provenance.${field}`, issues);
      }
    }
  }

  const requiresResolution = node.intent === 'action-needed' || node.intent === 'completed';
  if (requiresResolution && node.resolution === undefined) {
    issues.push({
      path: 'resolution',
      message: `${node.intent} observation은 resolution이 필요합니다.`,
    });
  }
  if (node.resolution !== undefined) {
    if (!isRecord(node.resolution)) {
      issues.push({ path: 'resolution', message: '객체여야 합니다.' });
    } else {
      requiredText(node.resolution.decisionId, 'resolution.decisionId', issues);
      if (!RESOLUTION_OUTCOMES.has(node.resolution.outcome as string)) {
        issues.push({
          path: 'resolution.outcome',
          message: 'accepted·deferred·rejected 중 하나여야 합니다.',
        });
      }
      if (
        options?.decisionIds &&
        typeof node.resolution.decisionId === 'string' &&
        !options.decisionIds.has(node.resolution.decisionId)
      ) {
        issues.push({
          path: 'resolution.decisionId',
          message: `참조한 decision이 없습니다: ${node.resolution.decisionId}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertDecisionNode(node: DecisionNode): void {
  const result = validateDecisionNode(node);
  if (!result.ok)
    throw new Error(`DecisionNode 계약 위반: ${result.issues.map((i) => i.path).join(', ')}`);
}

export function assertObservationNode(
  node: ObservationNode,
  options?: { readonly decisionIds?: ReadonlySet<string> },
): void {
  const result = validateObservationNode(node, options);
  if (!result.ok) {
    throw new Error(`ObservationNode 계약 위반: ${result.issues.map((i) => i.path).join(', ')}`);
  }
}
