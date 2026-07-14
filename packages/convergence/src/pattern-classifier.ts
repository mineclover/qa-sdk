// @def.boundary convergence-layer-group
/**
 * 패턴 분류 엔진 — event_key 시퀀스 + actor 컨텍스트를 분석하여 패턴 자동 판정.
 *
 * 입력: 세션의 이벤트 시퀀스
 * 출력: PatternClassification (behavior_pattern × identification_mode × confidence)
 *
 * @layer 측정 (Measurement)
 */

import type {
  PatternRule,
  PatternClassification,
  BehaviorPattern,
  IdentificationMode,
  PatternConfidence,
} from '@qa-sdk/core';

/** 분류 엔진 입력: 세션의 이벤트 목록 */
export interface ClassifierInput {
  readonly events: readonly ClassifierEvent[];
  readonly sessionId?: string;
  readonly platform?: string;
  readonly ownerType?: string;
}

/** 분류 엔진이 소비하는 이벤트 최소 인터페이스 */
export interface ClassifierEvent {
  readonly event_key: string;
  readonly timestamp: string;
  readonly actor_id?: string;
  readonly user_id?: string;
}

/**
 * 세션의 이벤트 시퀀스를 패턴으로 분류한다.
 *
 * 규칙은 priority 내림차순으로 평가. 첫 매칭 규칙을 채택.
 * 매칭 규칙이 없으면 unclassified.
 */
export function classifyPattern(
  input: ClassifierInput,
  rules: readonly PatternRule[],
): PatternClassification {
  const { events } = input;
  if (events.length === 0) {
    return makeResult('unclassified', detectIdMode(input), 'unknown', 'rule-empty', 0, 0);
  }

  const eventKeys = events.map((e) => e.event_key);
  const timestamps = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
  const durationMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  const idMode = detectIdMode(input);

  // 규칙을 priority 내림차순 정렬
  const sorted = [...rules].toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const rule of sorted) {
    // identification_mode 조건 확인
    if (rule.identificationMode !== 'any' && rule.identificationMode !== idMode) continue;

    const match = evaluateMatch(rule.match, eventKeys, events, durationMs);
    if (match) {
      return makeResult(
        rule.behaviorPattern,
        idMode,
        rule.defaultConfidence,
        rule.id,
        events.length,
        durationMs,
      );
    }
  }

  return makeResult('unclassified', idMode, 'unknown', 'rule-none', events.length, durationMs);
}

/** identification_mode 자동 판별 */
function detectIdMode(input: ClassifierInput): IdentificationMode {
  // 서비스 간 호출
  if (
    input.platform === 'node' &&
    (input.ownerType === 'workspace' || input.ownerType === 'tenant')
  ) {
    return 'service';
  }

  const first = input.events[0];
  if (!first) return 'anonymous';

  if (!first.actor_id || first.actor_id === 'anonymous' || first.actor_id === '') {
    return 'anonymous';
  }
  if (first.user_id) return 'identified';
  return 'pseudonymized';
}

/** 매칭 조건 평가 */
function evaluateMatch(
  cond: PatternRule['match'],
  eventKeys: readonly string[],
  events: readonly ClassifierEvent[],
  durationMs: number,
): boolean {
  // 이벤트 수 제한
  if (cond.minEvents !== undefined && events.length < cond.minEvents) return false;
  if (cond.maxEvents !== undefined && events.length > cond.maxEvents) return false;

  // 세션 시간 제한
  if (cond.maxDurationMs !== undefined && durationMs > cond.maxDurationMs) return false;

  // 필수 키 포함
  if (cond.requiredKeys) {
    for (const key of cond.requiredKeys) {
      if (!eventKeys.some((k) => matchKey(k, key))) return false;
    }
  }

  // 제외 키
  if (cond.excludedKeys) {
    for (const key of cond.excludedKeys) {
      if (eventKeys.some((k) => matchKey(k, key))) return false;
    }
  }

  // 순서 있는 시퀀스
  if (cond.requiredSequence && cond.requiredSequence.length > 0) {
    if (!containsSequence(eventKeys, cond.requiredSequence)) return false;
  }

  // event_key 패턴 (하나라도 매칭)
  if (cond.eventKeyPatterns && cond.eventKeyPatterns.length > 0) {
    const patterns = cond.eventKeyPatterns;
    const hasMatch = eventKeys.some((k) => patterns.some((p) => new RegExp(p).test(k)));
    if (!hasMatch) return false;
  }

  // actor 조건
  if (cond.actorCondition === 'has_actor') {
    if (!events[0]?.actor_id || events[0].actor_id === 'anonymous') return false;
  }
  if (cond.actorCondition === 'no_actor') {
    if (events[0]?.actor_id && events[0].actor_id !== 'anonymous') return false;
  }

  // 최소 이벤트 간격 (봇 감지)
  if (cond.minIntervalMs !== undefined && events.length >= 2) {
    const timestamps = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
    if (timestamps.length >= 2) {
      timestamps.sort((a, b) => a - b);
      let minGap = Infinity;
      for (let i = 1; i < timestamps.length; i++) {
        minGap = Math.min(minGap, timestamps[i] - timestamps[i - 1]);
      }
      if (minGap < cond.minIntervalMs) return false;
    }
  }

  return true;
}

/** event_key 매칭 (glob-like: * = any) */
function matchKey(actual: string, pattern: string): boolean {
  if (pattern === actual) return true;
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(actual);
  }
  return actual.startsWith(pattern);
}

/** 순서 있는 서브시퀀스 확인 */
function containsSequence(keys: readonly string[], seq: readonly string[]): boolean {
  let si = 0;
  for (const key of keys) {
    if (si < seq.length && matchKey(key, seq[si])) {
      si++;
    }
  }
  return si >= seq.length;
}

function makeResult(
  pattern: BehaviorPattern,
  idMode: IdentificationMode,
  confidence: PatternConfidence,
  ruleId: string,
  eventCount: number,
  durationMs: number,
): PatternClassification {
  return {
    pattern,
    identificationMode: idMode,
    confidence,
    matchedRuleId: ruleId,
    eventCount,
    durationMs,
    classifiedAt: new Date().toISOString(),
  };
}
