// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * 간단한 인메모리 메트릭 레지스트리 — labeled counter·gauge.
 * Prometheus text format 출력을 지원한다.
 *
 * series 식별자 = name + 정렬된 label 문자열. label key 순서는 series를 바꾸지 않는다.
 * cardinality 보호: label 값은 MAX_LABEL_VALUE_LENGTH로 자르고,
 * series 수가 MAX_SERIES를 넘으면 새 series는 `name{overflow="true"}`로 합친다.
 */

export type MetricLabels = Readonly<Record<string, string>>;
export type MetricType = 'counter' | 'gauge';

export interface MetricSeries {
  readonly name: string;
  readonly type: MetricType;
  readonly labels: MetricLabels;
  readonly value: number;
}

export interface MetricsCollector {
  /** counter 증가 */
  increment(name: string, labels?: MetricLabels, by?: number): void;
  /** gauge 설정 (마지막 값 유지) */
  setGauge(name: string, value: number, labels?: MetricLabels): void;
  /** 현재 전체 series (등록 순서) */
  snapshot(): readonly MetricSeries[];
  /** counter 증가 — increment의 기존 이름 (호출부 호환) */
  inc(name: string, labels?: MetricLabels, delta?: number): void;
  /** counter만 name → (label 문자열 → 값)으로 조회 (기존 호출부 호환) */
  getCounters(): Map<string, Map<string, number>>;
}

/** 부분 의존용 포트 — counter 증가만 필요한 소비자 */
export type MetricsCounterPort = Pick<MetricsCollector, 'increment'>;

export const MAX_LABEL_VALUE_LENGTH = 64;
export const MAX_SERIES = 1_000;
const OVERFLOW_LABELS: MetricLabels = { overflow: 'true' };
const TYPE_CONFLICT_METRIC = 'metrics_type_conflict_total';

interface MutableSeries {
  name: string;
  type: MetricType;
  labels: MetricLabels;
  value: number;
}

export function createMetricsCollector(): MetricsCollector {
  const series = new Map<string, MutableSeries>();
  const typeByName = new Map<string, MetricType>();

  /** series를 찾거나 만든다. type 충돌 시 undefined. */
  function resolve(name: string, type: MetricType, labels: MetricLabels) {
    const registered = typeByName.get(name);
    if (registered && registered !== type) {
      if (name !== TYPE_CONFLICT_METRIC) {
        bump(TYPE_CONFLICT_METRIC, { name }, 1);
      }
      return undefined;
    }
    typeByName.set(name, type);

    const normalized = normalizeLabels(labels);
    const key = name + serializeLabels(normalized);
    const existing = series.get(key);
    if (existing) return existing;

    if (series.size >= MAX_SERIES) {
      const overflowKey = name + serializeLabels(OVERFLOW_LABELS);
      const overflow = series.get(overflowKey);
      if (overflow) return overflow;
      const created: MutableSeries = { name, type, labels: OVERFLOW_LABELS, value: 0 };
      series.set(overflowKey, created);
      return created;
    }

    const created: MutableSeries = { name, type, labels: normalized, value: 0 };
    series.set(key, created);
    return created;
  }

  function bump(name: string, labels: MetricLabels, by: number) {
    const target = resolve(name, 'counter', labels);
    if (target) target.value += by;
  }

  return {
    increment(name, labels = {}, by = 1) {
      bump(name, labels, by);
    },
    inc(name, labels = {}, delta = 1) {
      bump(name, labels, delta);
    },
    setGauge(name, value, labels = {}) {
      const target = resolve(name, 'gauge', labels);
      if (target) target.value = value;
    },
    snapshot() {
      return [...series.values()].map((s) => ({
        name: s.name,
        type: s.type,
        labels: { ...s.labels },
        value: s.value,
      }));
    },
    getCounters() {
      const counters = new Map<string, Map<string, number>>();
      for (const s of series.values()) {
        if (s.type !== 'counter') continue;
        let bucket = counters.get(s.name);
        if (!bucket) {
          bucket = new Map();
          counters.set(s.name, bucket);
        }
        bucket.set(serializeLabels(s.labels), s.value);
      }
      return counters;
    },
  };
}

function normalizeLabels(labels: MetricLabels): MetricLabels {
  const out: Record<string, string> = {};
  for (const key of Object.keys(labels).sort()) {
    const value = labels[key];
    out[key] =
      value.length > MAX_LABEL_VALUE_LENGTH ? value.slice(0, MAX_LABEL_VALUE_LENGTH) : value;
  }
  return out;
}

/** Prometheus label 값 escape (`\`, `"`, 개행) */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** labels → Prometheus label string: `{key="val",key2="val2"}` (key 정렬) or `` */
export function serializeLabels(labels: MetricLabels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return `{${keys.map((k) => `${k}="${escapeLabelValue(labels[k])}"`).join(',')}}`;
}

/** series 목록 → Prometheus text format lines (이름별 `# TYPE` 1회) */
export function formatSeries(
  snapshot: readonly MetricSeries[],
  help: Readonly<Record<string, string>> = {},
): string[] {
  const groups = new Map<string, MetricSeries[]>();
  for (const s of snapshot) {
    const group = groups.get(s.name);
    if (group) group.push(s);
    else groups.set(s.name, [s]);
  }

  const lines: string[] = [];
  for (const [name, group] of groups) {
    if (help[name]) lines.push(`# HELP ${name} ${help[name]}`);
    lines.push(`# TYPE ${name} ${group[0].type}`);
    for (const s of group) {
      lines.push(`${name}${serializeLabels(s.labels)} ${s.value}`);
    }
  }
  return lines;
}

/** counter Map → Prometheus text format lines */
export function formatCounters(
  counters: Map<string, Map<string, number>>,
  help: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  for (const [name, bucket] of counters) {
    if (help[name]) lines.push(`# HELP ${name} ${help[name]}`);
    lines.push(`# TYPE ${name} counter`);
    for (const [labelStr, value] of bucket) {
      lines.push(`${name}${labelStr} ${value}`);
    }
  }
  return lines;
}

/** gauge 1개 → Prometheus text format lines */
export function formatGauge(
  name: string,
  value: number,
  helpText?: string,
  labels: MetricLabels = {},
): string[] {
  const lines: string[] = [];
  if (helpText) lines.push(`# HELP ${name} ${helpText}`);
  lines.push(`# TYPE ${name} gauge`);
  lines.push(`${name}${serializeLabels(labels)} ${value}`);
  return lines;
}
