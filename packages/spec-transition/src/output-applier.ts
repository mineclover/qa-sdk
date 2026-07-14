// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Output Applier — 축 entry 변경 적용.
 *
 * OutputMutation의 set/unset을 StateStore에 반영한다.
 */

import type { OutputMutation } from './transition.types.js';
import type { StateStore } from './state-store.js';

/**
 * output 변경을 StateStore에 적용하고 적용 후 스냅샷을 반환한다.
 *
 * - value: string → store.set (축 entry 설정)
 * - value: null → store.unset (축 entry 제거)
 */
export function applyOutput(
  output: OutputMutation,
  store: StateStore,
  contextId: string,
  resourceId: string,
): Record<string, string> {
  for (const assignment of output.set) {
    if (assignment.value === null) {
      store.unset(contextId, resourceId, assignment.axis);
    } else {
      store.set(contextId, resourceId, assignment.axis, assignment.value);
    }
  }

  return store.snapshot(contextId, resourceId);
}
