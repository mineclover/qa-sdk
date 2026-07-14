// @def.boundary ingest-system
// @def.doc ingest-system

import type { StoredRecord, MetricRollupStore, MetricRollupInsert } from '@qa-sdk/core';

/**
 * metric RecordKind 레코드를 1분 윈도우로 집계하여 MetricRollupStore에 upsert한다.
 *
 * - counter: 합산
 * - gauge: last-value + min/max/avg
 * - histogram: 별도 구현 필요 (현재 counter 방식으로 폴백)
 * - summary: 집계 불가, 원본 마지막 값 보존
 */
export async function aggregateMetrics(
  metrics: StoredRecord[],
  rollupStore: MetricRollupStore,
): Promise<number> {
  if (metrics.length === 0) return 0;

  // metric_name + address_context 기준으로 그룹핑
  const groups = new Map<string, StoredRecord[]>();
  for (const m of metrics) {
    const key = `${m.metricName ?? ''}:${JSON.stringify(m.addressContext ?? {})}`;
    const group = groups.get(key);
    if (group) group.push(m);
    else groups.set(key, [m]);
  }

  let upsertCount = 0;

  for (const [, group] of groups) {
    const first = group[0];
    const metricType = first.metricType ?? 'counter';
    const windowStart = truncateToMinute(first.timestamp);
    const windowEnd = new Date(windowStart.getTime() + 60_000);

    const rollup: MetricRollupInsert = {
      metricName: first.metricName ?? '',
      metricType,
      windowType: '1m',
      windowStart,
      windowEnd,
      addressContext: first.addressContext,
      labels: first.metricLabels,
      ...aggregateByType(metricType, group),
    };

    await rollupStore.upsert(rollup);
    upsertCount++;
  }

  return upsertCount;
}

function aggregateByType(type: string, records: StoredRecord[]): Partial<MetricRollupInsert> {
  const values = records.map((r) => r.metricValue).filter((v): v is number => v !== undefined);

  if (values.length === 0) return { aggCount: 0 };

  switch (type) {
    case 'counter':
      return {
        aggSum: values.reduce((s, v) => s + v, 0),
        aggCount: values.length,
      };
    case 'gauge':
      return {
        aggLast: values[values.length - 1],
        aggMin: Math.min(...values),
        aggMax: Math.max(...values),
        aggAvg: values.reduce((s, v) => s + v, 0) / values.length,
        aggCount: values.length,
      };
    case 'histogram':
      // histogram: 단순 합산 (버킷 머지는 향후 구현)
      return {
        aggSum: values.reduce((s, v) => s + v, 0),
        aggCount: values.length,
      };
    case 'summary':
      // summary: 집계 불가, 마지막 값 보존
      return {
        aggLast: values[values.length - 1],
        aggCount: values.length,
      };
    default:
      return {
        aggSum: values.reduce((s, v) => s + v, 0),
        aggCount: values.length,
      };
  }
}

function truncateToMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}
