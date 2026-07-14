// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * step schemaId 해석 — 정적 계보와 시뮬레이션 계보가 동일한 전략 사용.
 *
 * 우선순위: accesses writable(1개) > accesses readable(1개) > eventKey > facet > fallback
 */

import type { PipeStep } from '../types/pipe-spec.js';

export function resolveStepSchemaId(step: PipeStep, fallback: string): string {
  // 1. accesses에서 writable schema 단일이면 사용
  const writables = collectSchemaIds(step, ['write', 'readwrite']);
  if (writables.length === 1) return writables[0];

  // 2. accesses에서 read-only schema 단일이면 사용
  const readables = collectSchemaIds(step, ['read']);
  if (readables.length === 1) return readables[0];

  // 3. eventKey > facet > fallback
  return step.eventKey ?? step.facet ?? fallback;
}

function collectSchemaIds(step: PipeStep, modes: Array<'read' | 'write' | 'readwrite'>): string[] {
  const allowed = new Set(modes);
  const ids = new Set<string>();
  for (const access of step.dataContract?.accesses ?? []) {
    if (allowed.has(access.mode)) ids.add(access.schemaId);
  }
  return [...ids];
}
