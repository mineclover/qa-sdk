// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * 간단한 인메모리 메트릭 카운터/게이지 레지스트리.
 * Prometheus text format 출력을 지원한다.
 */

export interface MetricsCollector {
  /** counter 증가 */
  inc(name: string, labels?: Record<string, string>, delta?: number): void;
  /** 현재 counter 값 조회 */
  getCounters(): Map<string, Map<string, number>>;
}

export function createMetricsCollector(): MetricsCollector {
  const counters = new Map<string, Map<string, number>>();

  return {
    inc(name, labels = {}, delta = 1) {
      if (!counters.has(name)) counters.set(name, new Map());
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직후 .get()
      const bucket = counters.get(name)!;
      const key = serializeLabels(labels);
      bucket.set(key, (bucket.get(key) ?? 0) + delta);
    },
    getCounters() {
      return counters;
    },
  };
}

/** labels → Prometheus label string: `{key="val",key2="val2"}` or `` */
export function serializeLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
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
  labels: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  if (helpText) lines.push(`# HELP ${name} ${helpText}`);
  lines.push(`# TYPE ${name} gauge`);
  lines.push(`${name}${serializeLabels(labels)} ${value}`);
  return lines;
}
