// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Engine — 7단계 파이프라인.
 *
 * collect → match → bind → load state → validate input → apply output → emit instance
 *
 * registry의 모든 spec을 이벤트에 적용하고, 매칭되는 전이를 실행한다.
 * 이벤트는 timestamp 순으로 처리되며, 같은 입력 → 같은 출력 (deterministic).
 */

import { compareTimestamps } from '@qa-sdk/core';
import type {
  TransitionSpec,
  TransitionInstance,
  MatchPattern,
  CoordinatePattern,
} from './transition.types.js';
import type { StateStore } from './state-store.js';
import type { InputViolation } from './input-validator.js';
import { TransitionRegistry } from './transition.registry.js';
import { extractBind, type BindEventObject } from './bind-extractor.js';
import { validateInput } from './input-validator.js';
import { applyOutput } from './output-applier.js';

type TransitionEventValue =
  | string
  | number
  | boolean
  | null
  | readonly TransitionEventValue[]
  | { readonly [key: string]: TransitionEventValue };

// ── 결과 타입 ────────────────────────────────────────────

export interface TransitionResult {
  readonly instances: readonly TransitionInstance[];
  readonly unmatched_events: readonly string[];
  readonly violations: readonly InputViolation[];
}

// ── 이벤트 인터페이스 (engine의 EventRecord 최소 부분집합) ──

/**
 * TransitionEngine이 소비하는 이벤트 형식.
 *
 * **중요: address_context는 디코딩된 축 이름→entry 값 매핑이어야 한다.**
 *
 * 실제 ingest-server의 address_context는 인코딩된 prefix 주소를 담는다:
 *   `{ "tracking": "tracking:v2:42", "flow_point": "flow_point:v1:15" }`
 *
 * TransitionEngine은 이를 전제하지 않는다. 디코딩된 형태를 기대한다:
 *   `{ "trackAction": "submit", "page": "checkout", "flow_step": "entry" }`
 *
 * decode 책임은 호출자(ingest Phase 2.5 또는 전처리 어댑터)에 있다.
 * engine은 "이미 디코딩된 이벤트"만 받는다.
 */
export interface TransitionEvent {
  readonly log_id: string;
  readonly timestamp: string;
  readonly event_key?: string;
  /** 디코딩된 축 이름 → entry 값 매핑. 인코딩된 prefix 주소가 아님. */
  readonly address_context?: Readonly<Record<string, string>>;
  readonly payload?: TransitionEventValue;
  readonly [key: string]: TransitionEventValue | undefined;
}

// ── 내부 타입 ─────────────────────────────────────────────

interface MatchedCandidate {
  spec: TransitionSpec;
  matched: TransitionEvent[];
  context_id: string;
  resource_id: string;
  matched_at: string;
}

// ── Engine ────────────────────────────────────────────────

export class TransitionEngine {
  readonly registry: TransitionRegistry;
  readonly store: StateStore;

  constructor(registry: TransitionRegistry, store: StateStore) {
    this.registry = registry;
    this.store = store;
  }

  /**
   * 7단계 파이프라인 실행.
   *
   * 1. collect — timestamp 정렬
   * 2. match — 각 spec의 좌표 패턴 매칭
   * 3. bind — context_id, resource_id 추출
   * 4. load — StateStore에서 현재 스냅샷
   * 5. validate — input 조건 검증
   * 6. apply — output 변경 적용
   * 7. emit — TransitionInstance 생성
   */
  process(events: readonly TransitionEvent[]): TransitionResult {
    // Step 1: collect — timestamp 정렬
    const sorted = [...events].toSorted((a, b) => compareTimestamps(a.timestamp, b.timestamp));

    const specs = this.registry.list();
    const matchedEventIds = new Set<string>();

    // ── Pass 1: match + bind (상태 무관) ──────────────────
    // 모든 spec에 대해 좌표 매칭과 bind를 수행. 상태는 아직 확인하지 않는다.
    const candidates: MatchedCandidate[] = [];

    for (const spec of specs) {
      const matched = this.matchEvents(spec.match, sorted);
      if (!matched) continue;

      const matchedEvents: BindEventObject[] = matched.map((e) => e as BindEventObject);
      const bindResult = extractBind(spec.bind, matchedEvents);
      if (!bindResult.ok) continue;

      candidates.push({
        spec,
        matched,
        context_id: bindResult.result.context_id,
        resource_id: bindResult.result.resource_id,
        matched_at: matched[matched.length - 1].timestamp,
      });
    }

    // ── matched_at 기준 시간순 정렬 ──────────────────────
    // 시간적으로 먼저 완료된 전이가 먼저 상태를 적용한다.
    candidates.sort((a, b) => compareTimestamps(a.matched_at, b.matched_at));

    // ── Pass 2: load → validate → apply → emit ──────────
    const instances: TransitionInstance[] = [];
    const violations: InputViolation[] = [];

    for (const candidate of candidates) {
      const { spec, matched, context_id, resource_id } = candidate;

      matched.forEach((e) => matchedEventIds.add(e.log_id));

      // Step 4: load state
      const currentSnapshot = this.store.snapshot(context_id, resource_id);

      // Step 5: validate input
      const inputResult = validateInput(spec.input, currentSnapshot, {
        transition: spec.transition,
        context_id,
        resource_id,
      });

      if (!inputResult.valid) {
        violations.push(...inputResult.violations);
        continue;
      }

      const inputSnapshot = { ...currentSnapshot };

      // Step 6: apply output
      const outputSnapshot = applyOutput(spec.output, this.store, context_id, resource_id);

      // Step 7: emit
      instances.push({
        transition_name: spec.transition,
        spec_version: spec.version,
        context_id,
        resource_id,
        matched_event_ids: matched.map((e) => e.log_id),
        input_snapshot: inputSnapshot,
        output_snapshot: outputSnapshot,
        effect_kind: spec.effect.kind,
        matched_at: candidate.matched_at,
      });
    }

    // 매칭되지 않은 이벤트
    const unmatched = sorted.filter((e) => !matchedEventIds.has(e.log_id)).map((e) => e.log_id);

    return { instances, unmatched_events: unmatched, violations };
  }

  /**
   * 좌표 패턴 매칭.
   *
   * address_context의 차원 값으로 이벤트를 매칭한다.
   * - single: 첫 매칭 이벤트 1개
   * - ordered: 순서대로 모든 좌표 매칭 (greedy)
   */
  private matchEvents(
    match: MatchPattern,
    events: readonly TransitionEvent[],
  ): TransitionEvent[] | null {
    const coords = match.coordinates;

    if (match.mode === 'single') {
      for (const event of events) {
        if (this.matchCoordinate(coords[0], event)) {
          return [event];
        }
      }
      return null;
    }

    // ordered: 순차 greedy 매칭
    const matched: TransitionEvent[] = [];
    let coordIdx = 0;

    for (const event of events) {
      if (coordIdx >= coords.length) break;
      if (this.matchCoordinate(coords[coordIdx], event)) {
        matched.push(event);
        coordIdx++;
      }
    }

    return coordIdx === coords.length ? matched : null;
  }

  /** 단일 좌표 패턴과 이벤트 매칭 */
  private matchCoordinate(coord: CoordinatePattern, event: TransitionEvent): boolean {
    const ctx = event.address_context;
    if (!ctx) return false;

    for (const [dim, expectedValue] of Object.entries(coord)) {
      if (ctx[dim] !== expectedValue) return false;
    }
    return true;
  }
}
