import { describe, expect, it } from 'vitest';
import {
  createMetricsCollector,
  formatSeries,
  MAX_LABEL_VALUE_LENGTH,
  MAX_SERIES,
  serializeLabels,
} from './metrics-collector.js';

describe('MetricsCollector', () => {
  it('label 조합별로 counter를 분리한다', () => {
    const m = createMetricsCollector();
    m.increment('snapshot_gate_total', { result: 'ok' });
    m.increment('snapshot_gate_total', { result: 'ok' });
    m.increment('snapshot_gate_total', { result: 'missing' });
    expect(m.snapshot()).toEqual(
      expect.arrayContaining([
        { name: 'snapshot_gate_total', type: 'counter', labels: { result: 'ok' }, value: 2 },
        { name: 'snapshot_gate_total', type: 'counter', labels: { result: 'missing' }, value: 1 },
      ]),
    );
  });

  it('label key 순서가 달라도 같은 series다', () => {
    const m = createMetricsCollector();
    m.increment('x', { a: '1', b: '2' });
    m.increment('x', { b: '2', a: '1' });
    expect(m.snapshot().filter((s) => s.name === 'x')).toHaveLength(1);
  });

  it('gauge는 마지막 값을 유지한다', () => {
    const m = createMetricsCollector();
    m.setGauge('convergence_buffer_depth', 5);
    m.setGauge('convergence_buffer_depth', 2);
    expect(m.snapshot()).toContainEqual({
      name: 'convergence_buffer_depth',
      type: 'gauge',
      labels: {},
      value: 2,
    });
  });

  it('기존 inc API는 increment와 같은 series를 갱신한다', () => {
    const m = createMetricsCollector();
    m.inc('ingest_records_total', {}, 3);
    m.increment('ingest_records_total', {}, 2);
    expect(m.snapshot()).toContainEqual({
      name: 'ingest_records_total',
      type: 'counter',
      labels: {},
      value: 5,
    });
    expect(m.getCounters().get('ingest_records_total')?.get('')).toBe(5);
  });

  it('label 값은 최대 길이로 잘린다', () => {
    const m = createMetricsCollector();
    m.increment('long', { v: 'a'.repeat(MAX_LABEL_VALUE_LENGTH + 10) });
    const [series] = m.snapshot();
    expect(series.labels.v).toHaveLength(MAX_LABEL_VALUE_LENGTH);
  });

  it('series 수가 상한을 넘으면 새 series는 overflow series로 합쳐진다', () => {
    const m = createMetricsCollector();
    for (let i = 0; i < MAX_SERIES + 5; i++) {
      m.increment('card', { id: String(i) });
    }
    const card = m.snapshot().filter((s) => s.name === 'card');
    expect(card).toHaveLength(MAX_SERIES + 1);
    expect(card).toContainEqual({
      name: 'card',
      type: 'counter',
      labels: { overflow: 'true' },
      value: 5,
    });
  });

  it('같은 이름을 다른 type으로 쓰면 무시하고 충돌 counter를 올린다', () => {
    const m = createMetricsCollector();
    m.increment('dual');
    m.setGauge('dual', 9);
    const snap = m.snapshot();
    expect(snap.filter((s) => s.name === 'dual')).toEqual([
      { name: 'dual', type: 'counter', labels: {}, value: 1 },
    ]);
    expect(snap).toContainEqual({
      name: 'metrics_type_conflict_total',
      type: 'counter',
      labels: { name: 'dual' },
      value: 1,
    });
  });
});

describe('Prometheus 포맷', () => {
  it('serializeLabels는 key를 정렬하고 값을 escape한다', () => {
    expect(serializeLabels({ b: '2', a: 'x"y\\z\n' })).toBe('{a="x\\"y\\\\z\\n",b="2"}');
    expect(serializeLabels({})).toBe('');
  });

  it('formatSeries는 이름별 # TYPE 헤더 1개와 series 줄을 출력한다', () => {
    const m = createMetricsCollector();
    m.increment('phase_two_failures_total', { stage: 'verdict' });
    m.increment('phase_two_failures_total', { stage: 'convergence' }, 2);
    m.setGauge('convergence_buffer_depth', 7);
    const lines = formatSeries(m.snapshot(), {
      phase_two_failures_total: 'Phase 2 failures by stage',
    });
    expect(lines).toEqual([
      '# HELP phase_two_failures_total Phase 2 failures by stage',
      '# TYPE phase_two_failures_total counter',
      'phase_two_failures_total{stage="verdict"} 1',
      'phase_two_failures_total{stage="convergence"} 2',
      '# TYPE convergence_buffer_depth gauge',
      'convergence_buffer_depth 7',
    ]);
  });
});
