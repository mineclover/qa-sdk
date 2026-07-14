// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * PipeGraph 시뮬레이션 — dry-run, step-by-step 실행, 경로 추적
 *
 * 실제 부수효과 없이 PipeGraph를 가상 실행하여
 * 어떤 경로가 실행되는지, 어떤 이벤트가 생산되는지 추적한다.
 */

import type { PipeFlow, PipeSpec, PipeGraph, PipeConnection } from '../types/pipe-spec.js';
import { normalizeEndpointPipeIds } from './pipe-endpoint.js';

// ── 설정 ─────────────────────────────────────────────

export interface SimulationConfig {
  /** 실행할 그래프 */
  graph: PipeGraph;

  /** 초기 트리거 이벤트 */
  initialEvent: SimEvent;

  /**
   * 분기 해소: branch/conditional에서 어떤 경로를 선택할지 결정.
   * 반환값: 선택할 경로 인덱스 (0-based).
   * 미설정 시 기본값: 첫 번째 경로 (index 0).
   */
  branchResolver?: (condition: string, context: SimContext) => number;

  /**
   * 필터/dedup 해소: 통과할지 말지 결정.
   * 미설정 시 기본값: 항상 통과.
   */
  filterResolver?: (condition: string, context: SimContext) => boolean;

  /** race 해소: 어떤 것이 먼저 완료될지 결정. 반환값: 인덱스. */
  raceResolver?: (stepCount: number, context: SimContext) => number;

  /**
   * 실패 해소: retry/fallback/circuit-breaker에서 성공/실패 결정.
   * true = 성공 (try 경로), false = 실패 (catch/재시도 경로).
   * 미설정 시 기본값: 항상 성공 (true).
   */
  failureResolver?: (flowKind: string, context: SimContext) => boolean;

  /** 최대 시뮬레이션 스텝 (무한 루프 방지) */
  maxSteps?: number;
}

export interface SimEvent {
  eventKey: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

export interface SimContext {
  /** 현재까지 실행된 스텝 */
  steps: SimStep[];
  /** 현재 시뮬레이션 시간 */
  clock: number;
  /** 현재 파이프 ID */
  currentPipeId: string;
}

// ── 결과 ─────────────────────────────────────────────

export interface SimulationResult {
  /** 실행된 스텝 (시간순) */
  steps: SimStep[];
  /** 실행된 파이프 ID 순서 */
  pipeTrace: string[];
  /** 실행된 패싯 순서 */
  facetTrace: string[];
  /** 생산된 이벤트 */
  producedEvents: SimEvent[];
  /** 실행 상태 */
  status: 'complete' | 'max-steps-reached' | 'no-trigger-match';
  /** 총 시뮬레이션 시간 (ms) */
  totalTime: number;
  /** 총 실행 스텝 수 */
  totalSteps: number;
}

export interface SimStep {
  /** 소속 파이프 */
  pipeId: string;
  /** 흐름 내 위치 */
  flowPath: string;
  /** 흐름 제어 종류 */
  kind: string;
  /** 패싯 (step일 때) */
  facet?: string;
  /** 테스트 단계 (PipeStep.testPhase에서 전파) */
  phase?: import('../types/test-tracking.js').TestPhase;
  /** 이벤트 키 (step/emit일 때) */
  eventKey?: string;
  /** 시뮬레이션 시각 */
  timestamp: number;
  /** 실행 상태 */
  status: 'executed' | 'skipped' | 'filtered' | 'timeout';
}

// ── 시뮬레이터 ───────────────────────────────────────

export function simulate(config: SimulationConfig): SimulationResult {
  const {
    graph,
    initialEvent,
    branchResolver = () => 0,
    filterResolver = () => true,
    raceResolver = () => 0,
    failureResolver = () => true,
    maxSteps = 1000,
  } = config;

  // filterResolver가 명시적으로 제공되었는지 여부 (dedup 동작 분기에 사용)
  const hasExplicitFilterResolver = config.filterResolver !== undefined;

  const pipeMap = new Map(graph.pipes.map((p) => [p.pipeId, p]));
  const steps: SimStep[] = [];
  const pipeTrace: string[] = [];
  const facetTrace: string[] = [];
  const producedEvents: SimEvent[] = [];
  let clock = initialEvent.timestamp ?? 0;
  // stepCount는 steps.length로 대체

  // 이벤트 큐: 트리거 대기 이벤트
  const eventQueue: SimEvent[] = [initialEvent];

  // dedup 상태 추적: 시뮬레이션 실행 범위 내에서 seen 키 관리
  const dedupSeen = new Set<string>();

  while (eventQueue.length > 0) {
    if (steps.length >= maxSteps) {
      return buildResult('max-steps-reached');
    }

    const event = eventQueue.shift()!;

    // 이 이벤트로 트리거되는 파이프 찾기
    const triggered = graph.pipes.filter((p) => p.trigger.eventKey === event.eventKey);
    if (triggered.length === 0 && steps.length === 0) {
      return buildResult('no-trigger-match');
    }

    for (const pipe of triggered) {
      if (steps.length >= maxSteps) return buildResult('max-steps-reached');
      pipeTrace.push(pipe.pipeId);
      const ctx: SimContext = { steps, clock, currentPipeId: pipe.pipeId };

      // 파이프 내부 흐름 실행
      walkFlow(pipe.flow, pipe.pipeId, 'flow', ctx);

      // produces 이벤트 큐에 추가
      if (pipe.produces) {
        for (const eventKey of pipe.produces) {
          const produced: SimEvent = { eventKey, timestamp: clock };
          producedEvents.push(produced);
          // 그래프에서 이 이벤트를 트리거로 가진 연결이 있으면 큐에 추가
          const hasConsumer = graph.pipes.some((p) => p.trigger.eventKey === eventKey);
          if (hasConsumer) eventQueue.push(produced);
        }
      }

      // 연결 따라가기
      followConnections(pipe.pipeId, event);
    }
  }

  return buildResult('complete');

  // ── 내부 함수 ─────────────────────────────

  function walkFlow(flow: PipeFlow, pipeId: string, path: string, ctx: SimContext): void {
    if (steps.length >= maxSteps) return;

    switch (flow.kind) {
      case 'step': {
        const s: SimStep = {
          pipeId,
          flowPath: path,
          kind: 'step',
          facet: flow.facet,
          phase: flow.testPhase,
          eventKey: flow.eventKey,
          timestamp: clock,
          status: 'executed',
        };
        steps.push(s);
        facetTrace.push(flow.facet);
        if (flow.timeout) clock += flow.timeout;
        break;
      }

      case 'sequence':
        for (let i = 0; i < flow.steps.length; i++) {
          walkFlow(flow.steps[i], pipeId, `${path}.steps[${i}]`, ctx);
        }
        break;

      case 'branch': {
        const idx = branchResolver(flow.condition, ctx);
        const chosen = Math.min(idx, flow.paths.length - 1);
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'branch',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.paths[chosen], pipeId, `${path}.paths[${chosen}]`, ctx);
        break;
      }

      case 'optional': {
        const pass = filterResolver('optional', ctx);
        if (pass) {
          walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        } else {
          steps.push({
            pipeId,
            flowPath: path,
            kind: 'optional',
            timestamp: clock,
            status: 'skipped',
          });
        }
        break;
      }

      case 'parallel':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'parallel',
          timestamp: clock,
          status: 'executed',
        });
        for (let i = 0; i < flow.steps.length; i++) {
          walkFlow(flow.steps[i], pipeId, `${path}.steps[${i}]`, ctx);
        }
        break;

      case 'race': {
        const winner = raceResolver(flow.steps.length, ctx);
        steps.push({ pipeId, flowPath: path, kind: 'race', timestamp: clock, status: 'executed' });
        walkFlow(
          flow.steps[Math.min(winner, flow.steps.length - 1)],
          pipeId,
          `${path}.steps[${winner}]`,
          ctx,
        );
        break;
      }

      case 'await':
        steps.push({ pipeId, flowPath: path, kind: 'await', timestamp: clock, status: 'executed' });
        if (flow.timeout) clock += flow.timeout;
        walkFlow(flow.then, pipeId, `${path}.then`, ctx);
        break;

      case 'retry':
        steps.push({ pipeId, flowPath: path, kind: 'retry', timestamp: clock, status: 'executed' });
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'fallback': {
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'fallback',
          timestamp: clock,
          status: 'executed',
        });
        const success = failureResolver('fallback', ctx);
        if (success) {
          walkFlow(flow.try, pipeId, `${path}.try`, ctx);
        } else {
          walkFlow(flow.catch, pipeId, `${path}.catch`, ctx);
        }
        break;
      }

      case 'loop': {
        steps.push({ pipeId, flowPath: path, kind: 'loop', timestamp: clock, status: 'executed' });
        const loopMax = flow.maxIterations ?? 10;
        for (let iter = 0; iter < loopMax; iter++) {
          if (steps.length >= maxSteps) break;
          walkFlow(flow.body, pipeId, `${path}.body[${iter}]`, ctx);
          // branchResolver로 until 조건 평가: truthy(≠0) → 루프 종료
          const done = branchResolver(flow.until, ctx);
          if (done) break;
        }
        break;
      }

      case 'compensate':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'compensate',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.forward, pipeId, `${path}.forward`, ctx);
        break;

      case 'transition-scope':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'transition-scope',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        break;

      case 'emit': {
        const s: SimStep = {
          pipeId,
          flowPath: path,
          kind: 'emit',
          eventKey: flow.eventKey,
          timestamp: clock,
          status: 'executed',
        };
        steps.push(s);
        producedEvents.push({ eventKey: flow.eventKey, timestamp: clock });
        break;
      }

      case 'finally':
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        walkFlow(flow.cleanup, pipeId, `${path}.cleanup`, ctx);
        break;

      case 'timeout':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'timeout',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        break;

      case 'feedback':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'feedback',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        break;

      case 'map':
        steps.push({ pipeId, flowPath: path, kind: 'map', timestamp: clock, status: 'executed' });
        walkFlow(flow.itemFlow, pipeId, `${path}.itemFlow`, ctx);
        break;

      case 'reduce':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'reduce',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'buffer':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'buffer',
          timestamp: clock,
          status: 'executed',
        });
        if (flow.duration) clock += flow.duration;
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        break;

      case 'filter': {
        const pass = filterResolver(flow.condition, ctx);
        // 통과/차단 모두 기록: 통과 시 executed, 차단 시 filtered
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'filter',
          timestamp: clock,
          status: pass ? 'executed' : 'filtered',
        });
        if (pass) {
          walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        }
        break;
      }

      case 'circuit-breaker':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'circuit-breaker',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'throttle':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'throttle',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'debounce':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'debounce',
          timestamp: clock,
          status: 'executed',
        });
        clock += flow.wait;
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'split':
        steps.push({ pipeId, flowPath: path, kind: 'split', timestamp: clock, status: 'executed' });
        walkFlow(flow.itemFlow, pipeId, `${path}.itemFlow`, ctx);
        break;

      case 'enrich':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'enrich',
          timestamp: clock,
          status: 'executed',
        });
        if (flow.timeout) clock += flow.timeout;
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'tap':
        // observe 에러가 메인 흐름에 전파되지 않도록 격리
        try {
          walkFlow(flow.observe, pipeId, `${path}.observe`, ctx);
        } catch {
          // observe 실패는 무시 — 메인 step은 계속 실행
        }
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'resequence':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'resequence',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        break;

      case 'window':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'window',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.body, pipeId, `${path}.body`, ctx);
        break;

      case 'dedup': {
        // filterResolver가 명시 제공 시 resolver 기반, 미제공 시 seen-key 추적
        let pass: boolean;
        if (hasExplicitFilterResolver) {
          pass = filterResolver(`dedup:${flow.keyField}`, ctx);
        } else {
          const dedupKey = flow.keyField;
          pass = !dedupSeen.has(dedupKey);
          dedupSeen.add(dedupKey);
        }

        if (pass) {
          walkFlow(flow.step, pipeId, `${path}.step`, ctx);
        } else {
          steps.push({
            pipeId,
            flowPath: path,
            kind: 'dedup',
            timestamp: clock,
            status: 'filtered',
          });
        }
        break;
      }

      case 'correlation':
        steps.push({
          pipeId,
          flowPath: path,
          kind: 'correlation',
          timestamp: clock,
          status: 'executed',
        });
        walkFlow(flow.onMatch, pipeId, `${path}.onMatch`, ctx);
        break;
    }
  }

  function followConnections(fromPipeId: string, _event: SimEvent): void {
    const outgoing = graph.connections.filter((c) => {
      const froms = normalizeEndpointPipeIds(c.from);
      return froms.includes(fromPipeId);
    });

    for (const conn of outgoing) {
      const tos = normalizeEndpointPipeIds(conn.to);

      switch (conn.kind) {
        case 'next':
        case 'fan-out':
          for (const to of tos) {
            const pipe = pipeMap.get(to);
            if (pipe) {
              eventQueue.push({ eventKey: pipe.trigger.eventKey, timestamp: clock });
            }
          }
          break;

        case 'conditional': {
          const ctx: SimContext = { steps, clock, currentPipeId: fromPipeId };
          const pass = filterResolver(conn.condition ?? '', ctx);
          if (pass) {
            for (const to of tos) {
              const pipe = pipeMap.get(to);
              if (pipe) {
                eventQueue.push({ eventKey: pipe.trigger.eventKey, timestamp: clock });
              }
            }
          }
          break;
        }

        case 'event':
          // event 연결은 produces → trigger 매칭으로 자동 처리됨
          break;

        case 'error':
        case 'compensate':
        case 'feedback':
          // 시뮬레이션에서는 정상 경로만 (에러/보상/피드백은 별도 시뮬 필요)
          break;

        case 'join':
          // join은 모든 from이 완료되어야 — 단순 시뮬에서는 바로 실행
          for (const to of tos) {
            const pipe = pipeMap.get(to);
            if (pipe) {
              eventQueue.push({ eventKey: pipe.trigger.eventKey, timestamp: clock });
            }
          }
          break;
      }
    }
  }

  function buildResult(status: SimulationResult['status']): SimulationResult {
    return {
      steps,
      pipeTrace,
      facetTrace,
      producedEvents,
      status,
      totalTime: clock - (initialEvent.timestamp ?? 0),
      totalSteps: steps.length,
    };
  }
}

// ── Happy Path 검증 ─────────────────────────────────

/** 의도된 정상 경로 선언 */
export interface HappyPathSpec {
  /** 의도된 파이프 실행 순서 */
  expectedPipeTrace: string[];
  /** 의도된 패싯 실행 순서 (선택) */
  expectedFacets?: string[];
}

/** Happy path 매칭 결과 */
export interface HappyPathMatch {
  /** 전체 일치 여부 */
  match: boolean;
  /** 파이프 트레이스 일치 여부 */
  pipeTraceMatch: boolean;
  /** 패싯 트레이스 일치 여부 (expectedFacets 미제공 시 true) */
  facetMatch: boolean;
  /** 불일치 시 분기 지점 인덱스 */
  divergedAtIndex: number | null;
  /** 불일치 시 기대값 */
  expected: string | null;
  /** 불일치 시 실제값 */
  actual: string | null;
}

/**
 * 시뮬레이션 결과가 의도된 happy path와 일치하는지 검증한다.
 */
export function matchHappyPath(result: SimulationResult, spec: HappyPathSpec): HappyPathMatch {
  // 파이프 트레이스 비교
  const pipeMatch = arraysEqual(result.pipeTrace, spec.expectedPipeTrace);
  let divergedAtIndex: number | null = null;
  let expected: string | null = null;
  let actual: string | null = null;

  if (!pipeMatch) {
    const maxLen = Math.max(result.pipeTrace.length, spec.expectedPipeTrace.length);
    for (let i = 0; i < maxLen; i++) {
      if (result.pipeTrace[i] !== spec.expectedPipeTrace[i]) {
        divergedAtIndex = i;
        expected = spec.expectedPipeTrace[i] ?? null;
        actual = result.pipeTrace[i] ?? null;
        break;
      }
    }
  }

  // 패싯 트레이스 비교 (선택)
  const facetMatch = spec.expectedFacets
    ? arraysEqual(result.facetTrace, spec.expectedFacets)
    : true;

  if (pipeMatch && !facetMatch && spec.expectedFacets) {
    const maxLen = Math.max(result.facetTrace.length, spec.expectedFacets.length);
    for (let i = 0; i < maxLen; i++) {
      if (result.facetTrace[i] !== spec.expectedFacets[i]) {
        divergedAtIndex = i;
        expected = spec.expectedFacets[i] ?? null;
        actual = result.facetTrace[i] ?? null;
        break;
      }
    }
  }

  return {
    match: pipeMatch && facetMatch,
    pipeTraceMatch: pipeMatch,
    facetMatch,
    divergedAtIndex,
    expected,
    actual,
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
