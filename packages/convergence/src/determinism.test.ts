/**
 * convergence 결정론 — 같은 입력과 clock이면 같은 출력.
 *
 * G3(incremental convergence)의 cache key와 full/incremental differential test 전제.
 */

import { DEMO_CATALOG } from 'demo-snapshot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isoDate, type Clock } from './clock.js';
import { collectMetrics, metricsToObservations } from './metric-registry.js';
import { runConvergenceAnalysis } from './convergence-runner.js';
import { analyzeHeadroom } from './headroom-advisor.js';
import { classifyPattern } from './pattern-classifier.js';
import { detectAnomalies } from './pattern-anomaly.js';
import { buildPatternHealthReport } from './pattern-aggregator.js';
import { analyzeSelfCheck } from './self-check-analyzer.js';
import { SYSTEM_PATTERN_RULES } from './pattern-rules.js';
import { buildDeterminismFixture } from './__fixtures__/determinism-fixture.js';

const fixed =
  (iso: string): Clock =>
  () =>
    new Date(iso);

/** 자정 직전 — 평가 시점이 늦어지면 날짜가 바뀌는 경계 */
const BEFORE_MIDNIGHT = '2026-10-28T23:59:59.999Z';

/** 매 호출마다 1ms씩 진행하는 clock — 여러 번 평가되면 날짜가 바뀐다 */
function tickingClock(startIso: string): { clock: Clock; calls: () => number } {
  let n = 0;
  const start = new Date(startIso).getTime();
  return {
    clock: () => new Date(start + n++),
    calls: () => n,
  };
}

function runMetrics(clock: Clock) {
  const input = buildDeterminismFixture(DEMO_CATALOG, clock);
  const metrics = collectMetrics(input.catalog, input.graph, input.usage, { clock });
  return { metrics, observations: metricsToObservations(metrics, { clock }) };
}

describe('convergence 결정론', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('같은 입력과 clock이면 같은 metric·observation (정렬 순서 포함)', () => {
    const a = runMetrics(fixed(BEFORE_MIDNIGHT));
    const b = runMetrics(fixed(BEFORE_MIDNIGHT));
    expect(a.observations.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it('clock이 날짜를 결정한다 (자정 경계)', () => {
    const { metrics, observations } = runMetrics(fixed(BEFORE_MIDNIGHT));
    const day = isoDate(fixed(BEFORE_MIDNIGHT));
    expect(metrics.every((m) => m.measuredAt === day)).toBe(true);
    expect(observations.every((o) => o.date === day)).toBe(true);
  });

  it('collectMetrics는 실행당 clock을 한 번만 평가한다', () => {
    const input = buildDeterminismFixture(DEMO_CATALOG, fixed(BEFORE_MIDNIGHT));
    const ticking = tickingClock(BEFORE_MIDNIGHT);
    const metrics = collectMetrics(input.catalog, input.graph, input.usage, {
      clock: ticking.clock,
    });
    expect(ticking.calls()).toBe(1);
    expect(new Set(metrics.map((m) => m.measuredAt))).toEqual(new Set(['2026-10-28']));
  });

  it('analyzeHeadroom이 만든 Decision 날짜도 clock을 따른다', () => {
    const report = analyzeHeadroom([{ id: 'axis_x', name: 'X', entries: 4, capacity: 4 }], {
      clock: fixed(BEFORE_MIDNIGHT),
    });
    expect(report.decisions.length).toBeGreaterThan(0);
    expect(report.decisions.every((d) => d.date === '2026-10-28')).toBe(true);
  });

  it('runConvergenceAnalysis — 같은 입력과 clock이면 같은 리포트', () => {
    const clock = fixed(BEFORE_MIDNIGHT);
    const input = buildDeterminismFixture(DEMO_CATALOG, clock);
    const a = runConvergenceAnalysis(input.graph, input.usage, { clock });
    const b = runConvergenceAnalysis(input.graph, input.usage, { clock });
    expect(b).toEqual(a);
    expect(a.observations.every((o) => o.date === '2026-10-28')).toBe(true);
  });

  it('패턴 분류·이상 감지·건전성 보고서 시각이 clock을 따른다', () => {
    const clock = fixed(BEFORE_MIDNIGHT);
    const classification = classifyPattern(
      { events: [{ event_key: 'build:core', timestamp: '2026-10-28T00:00:00.000Z' }] },
      SYSTEM_PATTERN_RULES,
      { clock },
    );
    expect(classification.classifiedAt).toBe(BEFORE_MIDNIGHT);

    const unclassified = { ...classification, pattern: 'unclassified' as const };
    const anomalies = detectAnomalies({ current: [unclassified] }, { clock });
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.every((a) => a.detectedAt === BEFORE_MIDNIGHT)).toBe(true);

    expect(buildPatternHealthReport([classification], 0, { clock }).generatedAt).toBe(
      BEFORE_MIDNIGHT,
    );
  });

  it('analyzeSelfCheck — runId 기본값과 레코드 timestamp가 clock에서 나온다', () => {
    const clock = fixed(BEFORE_MIDNIGHT);
    const a = analyzeSelfCheck([], DEMO_CATALOG, undefined, { clock });
    const b = analyzeSelfCheck([], DEMO_CATALOG, undefined, { clock });
    expect(b).toEqual(a);
    expect(a.records.length).toBeGreaterThan(0);
    expect(a.records.every((r) => r.timestamp === BEFORE_MIDNIGHT)).toBe(true);
    expect(a.records[0].session_id).toBe(`analysis-${new Date(BEFORE_MIDNIGHT).getTime()}`);
  });

  it('clock 미지정 시 기존 동작 (시스템 시각의 날짜)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-02T03:04:05.000Z'));
    const input = buildDeterminismFixture(DEMO_CATALOG, () => new Date());
    const metrics = collectMetrics(input.catalog, input.graph, input.usage);
    const observations = metricsToObservations(metrics);
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every((o) => o.date === '2027-01-02')).toBe(true);
  });

  it('options.date는 clock보다 우선한다', () => {
    const { metrics } = runMetrics(fixed(BEFORE_MIDNIGHT));
    const observations = metricsToObservations(metrics, {
      date: '2020-01-01',
      clock: fixed(BEFORE_MIDNIGHT),
    });
    expect(observations.every((o) => o.date === '2020-01-01')).toBe(true);
  });
});
