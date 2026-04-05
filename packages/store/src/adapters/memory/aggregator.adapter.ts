import {
  compareTimestamps,
  type Aggregator,
  type AggregateEntry,
  type AggregateOptions,
  type AxisProjectionEntry,
} from "@qa-sdk/core";

/** decode 함수 시그니처 — 외부에서 주입 */
export type DecodeFn = (key: string) => Record<string, string> | undefined;

interface StoredItem {
  readonly key: string;
  readonly timestamp: string;
  readonly payload?: Record<string, unknown>;
}

/**
 * InMemory Aggregator — 개발/테스트용.
 *
 * 실 프로덕션에서는 DB GROUP BY 또는 Materialized View로 대체한다.
 */
export class InMemoryAggregator implements Aggregator {
  private readonly items: StoredItem[] = [];
  private readonly decodeFn: DecodeFn | undefined;

  constructor(opts?: { decode?: DecodeFn }) {
    this.decodeFn = opts?.decode;
  }

  /** 테스트용 데이터 주입 */
  ingest(key: string, timestamp: string, payload?: Record<string, unknown>): void {
    this.items.push({ key, timestamp, payload });
  }

  async groupByKey(
    keys: readonly string[],
    options?: AggregateOptions,
  ): Promise<AggregateEntry[]> {
    const keySet = new Set(keys);
    const filtered = this.filterByTime(options).filter(item => keySet.has(item.key));

    const groups = new Map<string, { count: number; lastSeen: string; payload?: Record<string, unknown> }>();

    for (const item of filtered) {
      const existing = groups.get(item.key);
      if (!existing || compareTimestamps(item.timestamp, existing.lastSeen) > 0) {
        groups.set(item.key, {
          count: (existing?.count ?? 0) + 1,
          lastSeen: item.timestamp,
          payload: item.payload,
        });
      } else {
        existing.count++;
      }
    }

    const entries: AggregateEntry[] = [];
    for (const [key, g] of groups) {
      entries.push({
        key,
        count: g.count,
        lastSeen: g.lastSeen,
        ...(g.payload != null ? { payloadSummary: g.payload } : {}),
      });
    }

    // count 내림차순 정렬
    entries.sort((a, b) => b.count - a.count);

    return options?.limit ? entries.slice(0, options.limit) : entries;
  }

  async projectAxis(
    keys: readonly string[],
    axes: readonly string[],
    options?: AggregateOptions,
  ): Promise<AxisProjectionEntry[]> {
    if (!this.decodeFn) {
      throw new Error("projectAxis에는 decode 함수가 필요합니다");
    }

    const keySet = new Set(keys);
    const filtered = this.filterByTime(options).filter(item => keySet.has(item.key));

    // 키 → 축 프로젝션 → 조합별 count
    const projections = new Map<string, { values: Record<string, string>; count: number }>();

    for (const item of filtered) {
      const decoded = this.decodeFn(item.key);
      if (!decoded) continue;

      // 지정된 축 값만 추출
      const projected: Record<string, string> = {};
      for (const axis of axes) {
        projected[axis] = decoded[axis] ?? "";
      }

      const projKey = axes.map(a => projected[a]).join("|");
      const existing = projections.get(projKey);
      if (existing) {
        existing.count++;
      } else {
        projections.set(projKey, { values: projected, count: 1 });
      }
    }

    const entries: AxisProjectionEntry[] = [];
    for (const p of projections.values()) {
      entries.push({ axisValues: p.values, count: p.count });
    }

    entries.sort((a, b) => b.count - a.count);
    return options?.limit ? entries.slice(0, options.limit) : entries;
  }

  private filterByTime(options?: AggregateOptions): StoredItem[] {
    if (!options?.from && !options?.to) return this.items;

    return this.items.filter(item => {
      if (options.from && compareTimestamps(item.timestamp, options.from) < 0) return false;
      if (options.to && compareTimestamps(item.timestamp, options.to) > 0) return false;
      return true;
    });
  }
}
