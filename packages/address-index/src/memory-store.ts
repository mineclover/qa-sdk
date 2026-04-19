// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/* ------------------------------------------------------------------ */
/*  InMemoryAddressIndex                                                */
/*                                                                      */
/*  자료구조:                                                            */
/*    prefixMap : prefixId → SortedAddressEntries[]  (주소 정렬)        */
/*    recordMap : recordId → { prefixId → { version, address } }       */
/*    timestamps: recordId → timestamp                                  */
/*                                                                      */
/*  범위 검색: 정렬된 배열에서 이진 탐색 (O(log N + K))                  */
/* ------------------------------------------------------------------ */

import type { AddressIndex } from "./port.js";
import type {
  AddressQuery,
  AddressHit,
  AddressStats,
  CrossPrefixQuery,
} from "./types.js";
import { parseAddressContext } from "./types.js";

/** 정렬된 주소 엔트리 (prefixMap 내부) */
interface SortedEntry {
  address: number;
  version: string;
  recordId: string;
  timestamp: string;
}

export class InMemoryAddressIndex implements AddressIndex {
  /** prefixId → 주소 정렬 엔트리 배열 */
  private prefixMap = new Map<string, SortedEntry[]>();
  /** recordId → prefix별 주소 */
  private recordMap = new Map<
    string,
    Record<string, { version: string; address: number }>
  >();
  /** recordId → timestamp */
  private timestamps = new Map<string, string>();

  /* ---- 인덱싱 ---- */

  async index(
    recordId: string,
    addressContext: Record<string, string>,
    timestamp: string,
  ): Promise<void> {
    const parsed = parseAddressContext(addressContext);
    if (parsed.length === 0) return;

    // 재인덱싱: 기존 엔트리 제거 (prefixMap 중복 방지)
    if (this.recordMap.has(recordId)) {
      this.removeFromPrefixMap(recordId);
    }

    const addrMap: Record<string, { version: string; address: number }> = {};

    for (const { prefixId, version, address } of parsed) {
      if (!this.prefixMap.has(prefixId)) {
        this.prefixMap.set(prefixId, []);
      }
      // eslint-disable-next-line typescript/no-non-null-assertion -- 직전에 .has() 확인 후 .set()으로 보장
      const entries = this.prefixMap.get(prefixId)!;
      const entry: SortedEntry = { address, version, recordId, timestamp };
      insertSorted(entries, entry);

      addrMap[prefixId] = { version, address };
    }

    this.recordMap.set(recordId, addrMap);
    this.timestamps.set(recordId, timestamp);
  }

  /** prefixMap에서 특정 recordId의 모든 엔트리 제거 */
  private removeFromPrefixMap(recordId: string): void {
    for (const [, entries] of this.prefixMap) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].recordId === recordId) {
          entries.splice(i, 1);
        }
      }
    }
  }

  /* ---- 단일 prefix 조회 ---- */

  async find(query: AddressQuery): Promise<AddressHit[]> {
    const entries = this.prefixMap.get(query.prefixId);
    if (!entries || entries.length === 0) return [];

    const { version, address, addressRange, timeRange, limit = 100, offset = 0 } = query;

    let candidates: SortedEntry[];

    if (address != null) {
      // 정확 매치 — 이진 탐색
      candidates = findExact(entries, address);
    } else if (addressRange) {
      // 범위 검색 — 이진 탐색으로 시작점 찾고 순회
      candidates = findRange(entries, addressRange.from, addressRange.to);
    } else {
      // 전체 (prefix만 지정)
      candidates = entries;
    }

    // 필터링
    const results: AddressHit[] = [];
    for (const c of candidates) {
      if (version && c.version !== version) continue;
      if (timeRange) {
        if (timeRange.from && c.timestamp < timeRange.from) continue;
        if (timeRange.to && c.timestamp > timeRange.to) continue;
      }

      const allAddrs = this.recordMap.get(c.recordId);
      if (!allAddrs) continue;

      results.push({
        recordId: c.recordId,
        addresses: allAddrs,
        timestamp: c.timestamp,
      });
    }

    return results.slice(offset, offset + limit);
  }

  /* ---- 다중 prefix 교차 조회 ---- */

  async findCross(query: CrossPrefixQuery): Promise<AddressHit[]> {
    const { constraints, timeRange, limit = 100, offset = 0 } = query;
    if (constraints.length === 0) return [];

    // 각 constraint에서 recordId 셋 수집
    const idSets: Set<string>[] = [];

    for (const constraint of constraints) {
      const merged = { ...constraint, timeRange: timeRange ?? constraint.timeRange };
      const hits = await this.find({ ...merged, limit: Number.MAX_SAFE_INTEGER, offset: 0 });
      idSets.push(new Set(hits.map((h) => h.recordId)));
    }

    // 교집합
    const intersection = intersect(idSets);

    // 결과 조립
    const results: AddressHit[] = [];
    for (const recordId of intersection) {
      const allAddrs = this.recordMap.get(recordId);
      const ts = this.timestamps.get(recordId);
      if (!allAddrs || !ts) continue;

      results.push({ recordId, addresses: allAddrs, timestamp: ts });
    }

    // 시간순 정렬
    results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return results.slice(offset, offset + limit);
  }

  /* ---- 개별 레코드 조회 ---- */

  async getAddresses(
    recordId: string,
  ): Promise<Record<string, { version: string; address: number }> | null> {
    return this.recordMap.get(recordId) ?? null;
  }

  /* ---- 통계 ---- */

  async stats(prefixId?: string): Promise<AddressStats[]> {
    const results: AddressStats[] = [];

    const targets = prefixId
      ? [[prefixId, this.prefixMap.get(prefixId)] as const]
      : [...this.prefixMap.entries()];

    for (const [pid, entries] of targets) {
      if (!entries || entries.length === 0) {
        if (prefixId) {
          results.push({
            prefixId: pid,
            recordCount: 0,
            uniqueAddresses: 0,
            addressRange: null,
          });
        }
        continue;
      }

      const uniqueAddrs = new Set(entries.map((e) => e.address));

      results.push({
        prefixId: pid,
        recordCount: entries.length,
        uniqueAddresses: uniqueAddrs.size,
        addressRange: {
          min: entries[0].address,
          max: entries[entries.length - 1].address,
        },
      });
    }

    return results.toSorted((a, b) => b.recordCount - a.recordCount);
  }

  /* ---- 유틸 ---- */

  async count(): Promise<number> {
    return this.recordMap.size;
  }

  async clear(): Promise<void> {
    this.prefixMap.clear();
    this.recordMap.clear();
    this.timestamps.clear();
  }
}

/* ================================================================== */
/*  내부 유틸                                                          */
/* ================================================================== */

/** 주소 기준 정렬 삽입 (이진 탐색) */
function insertSorted(arr: SortedEntry[], entry: SortedEntry): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].address < entry.address) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, entry);
}

/** 정확 매치 — 이진 탐색으로 시작점 찾고 동일 주소 수집 */
function findExact(arr: SortedEntry[], address: number): SortedEntry[] {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].address < address) lo = mid + 1;
    else hi = mid;
  }

  const results: SortedEntry[] = [];
  while (lo < arr.length && arr[lo].address === address) {
    results.push(arr[lo]);
    lo++;
  }
  return results;
}

/** 범위 검색 — [from, to] inclusive */
function findRange(
  arr: SortedEntry[],
  from: number,
  to: number,
): SortedEntry[] {
  // from 이상 첫 위치
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].address < from) lo = mid + 1;
    else hi = mid;
  }

  const results: SortedEntry[] = [];
  while (lo < arr.length && arr[lo].address <= to) {
    results.push(arr[lo]);
    lo++;
  }
  return results;
}

/** Set 교집합 */
function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const sorted = [...sets].toSorted((a, b) => a.size - b.size);
  const [first, ...rest] = sorted;
  const result = new Set<string>();
  for (const id of first) {
    if (rest.every((s) => s.has(id))) result.add(id);
  }
  return result;
}
