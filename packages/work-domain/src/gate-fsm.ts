// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * Gate FSM — 품질 게이트 상태 머신 + 번들 파생.
 *
 * harness.ts에서 추출 — 순수 상태 전이 로직.
 * 의존 없음. property testing에 적합.
 */

/**
 * 단일 게이트 상태.
 *
 * idle → ready → gathering → running → passed/failed → stale
 */
export type GateState =
  | 'idle'
  | 'blocked'
  | 'ready'
  | 'gathering'
  | 'running'
  | 'passed'
  | 'failed'
  | 'stale'
  | 'skipped';

/** 게이트 상태 전이 이벤트 */
export type GateEvent =
  | { type: 'schedule' }
  | { type: 'prereqs_met' }
  | { type: 'prereqs_blocked' }
  | { type: 'gather_start' }
  | { type: 'gather_done' }
  | { type: 'gather_invalid' }
  | { type: 'exit'; code: number }
  | { type: 'source_changed' }
  | { type: 'retry' }
  | { type: 'skip' }
  | { type: 'reset' };

/** 순수 전이 함수. 유효하지 않은 전이는 현재 상태를 그대로 반환. */
export function transitionGate(state: GateState, event: GateEvent): GateState {
  if (event.type === 'skip') return 'skipped';
  if (event.type === 'reset') return 'idle';

  switch (state) {
    case 'idle':
      if (event.type === 'schedule') return 'ready';
      if (event.type === 'prereqs_blocked') return 'blocked';
      break;
    case 'blocked':
      if (event.type === 'prereqs_met') return 'ready';
      break;
    case 'ready':
      if (event.type === 'gather_start') return 'gathering';
      if (event.type === 'prereqs_blocked') return 'blocked';
      break;
    case 'gathering':
      if (event.type === 'gather_done') return 'running';
      if (event.type === 'gather_invalid') return 'blocked';
      break;
    case 'running':
      if (event.type === 'exit') return event.code === 0 ? 'passed' : 'failed';
      break;
    case 'passed':
      if (event.type === 'source_changed') return 'stale';
      break;
    case 'failed':
      if (event.type === 'retry') return 'ready';
      break;
    case 'stale':
      if (event.type === 'retry') return 'ready';
      break;
    case 'skipped':
      if (event.type === 'schedule') return 'ready';
      break;
  }

  return state;
}

// ─── 번들 상태 (파생) ──────────────────────────────────

/**
 * 번들(anchor 문서) 상태. 하위 gate 상태의 합산으로 파생.
 */
export type BundleState = 'empty' | 'pending' | 'gathering' | 'partial' | 'complete' | 'degraded';

/** 하위 gate 상태 배열에서 번들 상태를 파생한다. */
export function deriveBundleState(gateStates: readonly GateState[]): BundleState {
  if (gateStates.length === 0) return 'empty';

  const active = gateStates.filter((s) => s !== 'skipped');
  if (active.length === 0) return 'complete';

  const hasFailed = active.some((s) => s === 'failed');
  const hasStale = active.some((s) => s === 'stale');
  if (hasFailed || hasStale) return 'degraded';

  const allPassed = active.every((s) => s === 'passed');
  if (allPassed) return 'complete';

  const hasPassed = active.some((s) => s === 'passed');
  if (hasPassed) return 'partial';

  const hasGathering = active.some((s) => s === 'gathering' || s === 'running');
  if (hasGathering) return 'gathering';

  return 'pending';
}
