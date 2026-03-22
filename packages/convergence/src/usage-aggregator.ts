/**
 * UsageAggregator — address_context에서 UsageData를 집계한다.
 *
 * EventRecord[] → EntryUsage[] + AddressUsage[] + CoOccurrence[]
 *
 * 이것이 관측 파이프라인의 핵심:
 * 런타임 이벤트 → 집계 → 수렴 레이어 입력
 *
 * @layer 집계 (Aggregation)
 */

import type { Catalog } from "@qa-sdk/core";
import { decodePrefix, parseSerializedAddress, compareTimestamps } from "@qa-sdk/core";
import type { UsageData, EntryUsage, AddressUsage, CoOccurrence, CollectionHealthReport, OrphanAddress, StaleVersionUsage } from "./convergence.types.js";

/** 실행 모드 — 이 데이터가 왜 존재하는가 */
export type ExecutionMode = "live" | "test" | "synthetic" | "replay";

/** 집계 입력: EventRecord에서 추출한 주소 컨텍스트 + 식별자 */
export interface AddressContextRecord {
  readonly address_context: Record<string, string>;
  readonly timestamp: string;
  /** 이벤트 고유 ID */
  readonly log_id?: string;
  /** 트레이스 ID — 요청 단위 추적 */
  readonly trace_id?: string;
  /** 세션 ID — 사용자/테스트 세션 단위 */
  readonly session_id?: string;
  /** 이벤트 키 */
  readonly event_key?: string;
  /** 행위 주체 식별자 (패턴 분류용) */
  readonly actor_id?: string;
  /** 실제 서비스 유저 ID (패턴 분류용) */
  readonly user_id?: string;
  /** 실행 모드 — live/test/synthetic/replay */
  readonly execution_mode?: ExecutionMode;
  /** 실행 식별자 — 테스트 suite ID 등 */
  readonly execution_id?: string;
}

/**
 * address_context 레코드 배열에서 UsageData를 집계한다.
 */
export function aggregateUsageData(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
): UsageData {
  const entryCountMap = new Map<string, { axisId: string; entry: string; count: number; lastSeen: string }>();
  const addressCountMap = new Map<string, { prefix: string; version: string; address: number; count: number }>();
  const coOccurrenceMap = new Map<string, {
    sourcePrefix: string; sourceEntry: string;
    targetPrefix: string; targetEntry: string;
    count: number; totalSourceCount: number;
  }>();
  const sourceCounts = new Map<string, number>();

  // 식별자 수집
  const traceSet = new Set<string>();
  const sessionSet = new Set<string>();
  const eventKeySet = new Set<string>();
  const execModeCounts: Record<string, number> = {};
  const execIdCounts: Record<string, number> = {};
  // version별 사용량 — 배포 상태 추적
  const versionCountMap = new Map<string, { prefix: string; version: string; count: number; lastSeen: string; sessions: Set<string> }>();
  let totalRecords = 0;

  for (const record of records) {
    totalRecords++;
    if (record.trace_id) traceSet.add(record.trace_id);
    if (record.session_id) sessionSet.add(record.session_id);
    if (record.event_key) eventKeySet.add(record.event_key);
    const mode = record.execution_mode ?? "live";
    execModeCounts[mode] = (execModeCounts[mode] ?? 0) + 1;
    if (record.execution_id) {
      execIdCounts[record.execution_id] = (execIdCounts[record.execution_id] ?? 0) + 1;
    }

    const ctx = record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) continue;

    // 각 prefix의 address 집계
    const decodedPrefixes: Array<{ prefixId: string; entries: Record<string, string | number> }> = [];

    for (const [prefixId, serialized] of Object.entries(ctx)) {
      let parsed;
      try { parsed = parseSerializedAddress(serialized); } catch { continue; }

      const { version, address } = parsed;

      // AddressUsage
      const addrKey = serialized;
      const existing = addressCountMap.get(addrKey);
      if (existing) existing.count++;
      else addressCountMap.set(addrKey, { prefix: prefixId, version, address, count: 1 });

      // VersionUsage — 배포 상태 추적
      const vKey = `${prefixId}:${version}`;
      const vExisting = versionCountMap.get(vKey);
      if (vExisting) {
        vExisting.count++;
        if (compareTimestamps(record.timestamp, vExisting.lastSeen) > 0) vExisting.lastSeen = record.timestamp;
        if (record.session_id) vExisting.sessions.add(record.session_id);
      } else {
        const sessions = new Set<string>();
        if (record.session_id) sessions.add(record.session_id);
        versionCountMap.set(vKey, { prefix: prefixId, version, count: 1, lastSeen: record.timestamp, sessions });
      }

      // decode → EntryUsage
      try {
        const decoded = decodePrefix(catalog, prefixId, version, address);
        const entries: Record<string, string | number> = {};

        for (const [label, dim] of Object.entries(decoded)) {
          entries[label] = dim.value;
          const entryKey = `${label}:${dim.value}`;
          const ex = entryCountMap.get(entryKey);
          if (ex) {
            ex.count++;
            if (compareTimestamps(record.timestamp, ex.lastSeen) > 0) ex.lastSeen = record.timestamp;
          } else {
            entryCountMap.set(entryKey, {
              axisId: label,
              entry: String(dim.value),
              count: 1,
              lastSeen: record.timestamp,
            });
          }
        }

        decodedPrefixes.push({ prefixId, entries });
      } catch {
        // decode 실패는 무시
      }
    }

    // CoOccurrence: 같은 레코드에 함께 나타난 prefix 쌍
    for (let i = 0; i < decodedPrefixes.length; i++) {
      const src = decodedPrefixes[i];
      const srcKey = `${src.prefixId}:${Object.values(src.entries)[0] ?? ""}`;
      sourceCounts.set(srcKey, (sourceCounts.get(srcKey) ?? 0) + 1);

      for (let j = i + 1; j < decodedPrefixes.length; j++) {
        const tgt = decodedPrefixes[j];

        // 각 prefix의 첫 번째 entry를 대표값으로 사용
        const srcEntry = String(Object.values(src.entries)[0] ?? "");
        const tgtEntry = String(Object.values(tgt.entries)[0] ?? "");

        const coKey = `${src.prefixId}:${srcEntry}→${tgt.prefixId}:${tgtEntry}`;
        const ex = coOccurrenceMap.get(coKey);
        if (ex) ex.count++;
        else coOccurrenceMap.set(coKey, {
          sourcePrefix: src.prefixId,
          sourceEntry: srcEntry,
          targetPrefix: tgt.prefixId,
          targetEntry: tgtEntry,
          count: 1,
          totalSourceCount: 0, // 나중에 채움
        });
      }
    }
  }

  // totalSourceCount 채우기
  for (const co of coOccurrenceMap.values()) {
    const srcKey = `${co.sourcePrefix}:${co.sourceEntry}`;
    co.totalSourceCount = sourceCounts.get(srcKey) ?? co.count;
  }

  // 결과 정렬
  const timestamps = records.map(r => r.timestamp).filter(Boolean).sort();

  // versionUsages 정리
  const versionUsages = [...versionCountMap.values()]
    .map(v => ({ prefix: v.prefix, version: v.version, count: v.count, lastSeen: v.lastSeen, sessions: [...v.sessions] }))
    .sort((a, b) => b.count - a.count);

  return {
    entryUsages: [...entryCountMap.values()].sort((a, b) => b.count - a.count),
    addressUsages: [...addressCountMap.values()].sort((a, b) => b.count - a.count),
    coOccurrences: [...coOccurrenceMap.values()].sort((a, b) => b.count - a.count),
    versionUsages,
    collectionPeriod: {
      from: timestamps[0] ?? "",
      to: timestamps[timestamps.length - 1] ?? "",
    },
    sourceStats: {
      totalRecords,
      uniqueTraces: traceSet.size,
      uniqueSessions: sessionSet.size,
      uniqueEventKeys: eventKeySet.size,
      traceIds: [...traceSet],
      sessionIds: [...sessionSet],
      eventKeys: [...eventKeySet],
      byExecutionMode: execModeCounts,
      byExecutionId: execIdCounts,
    },
  };
}

/**
 * 수집된 address_context의 건전성을 분석한다.
 *
 * 감지 항목:
 * 1. 고아 주소 — 카탈로그에 없는 prefix를 참조
 * 2. 고아 버전 — 카탈로그에 없는 version을 참조
 * 3. 디코드 실패 — 주소가 유효 범위를 벗어남
 * 4. 구버전 사용 — 최신이 아닌 version을 사용
 */
export function analyzeCollectionHealth(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
): CollectionHealthReport {
  const orphans = new Map<string, OrphanAddress>();
  const staleMap = new Map<string, StaleVersionUsage>();
  let totalAddresses = 0;
  let validAddresses = 0;

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx) continue;

    for (const [prefixId, serialized] of Object.entries(ctx)) {
      totalAddresses++;

      let parsed;
      try { parsed = parseSerializedAddress(serialized); } catch {
        const key = `${prefixId}:parse-fail`;
        const ex = orphans.get(key);
        if (ex) (ex as { count: number }).count++;
        else orphans.set(key, { prefixId, serialized, count: 1, reason: "decode-failed" });
        continue;
      }

      const { version, address } = parsed;

      // 1. prefix 존재 확인
      const prefix = catalog.prefixes[prefixId];
      if (!prefix) {
        const key = `${prefixId}:unknown`;
        const ex = orphans.get(key);
        if (ex) (ex as { count: number }).count++;
        else orphans.set(key, { prefixId, serialized, count: 1, reason: "unknown-prefix" });
        continue;
      }

      // 2. version 존재 확인
      const versionDef = prefix.versions.find(v => v.version === version);
      if (!versionDef) {
        const key = `${prefixId}:${version}:unknown-ver`;
        const ex = orphans.get(key);
        if (ex) (ex as { count: number }).count++;
        else orphans.set(key, { prefixId, serialized, count: 1, reason: "unknown-version" });
        continue;
      }

      // 3. decode 가능 확인
      if (isNaN(address)) {
        const key = `${prefixId}:${version}:nan`;
        const ex = orphans.get(key);
        if (ex) (ex as { count: number }).count++;
        else orphans.set(key, { prefixId, serialized, count: 1, reason: "decode-failed" });
        continue;
      }

      try {
        decodePrefix(catalog, prefixId, version, address);
      } catch {
        const key = `${prefixId}:${version}:${address}:decode-fail`;
        const ex = orphans.get(key);
        if (ex) (ex as { count: number }).count++;
        else orphans.set(key, { prefixId, serialized, count: 1, reason: "decode-failed" });
        continue;
      }

      validAddresses++;

      // 4. 구버전 감지
      const latestVersion = prefix.versions[prefix.versions.length - 1].version;
      if (version !== latestVersion) {
        const key = `${prefixId}:${version}`;
        const latestIdx = prefix.versions.findIndex(v => v.version === latestVersion);
        const usedIdx = prefix.versions.findIndex(v => v.version === version);
        const gap = latestIdx - usedIdx;

        const ex = staleMap.get(key);
        if (ex) (ex as { count: number }).count++;
        else staleMap.set(key, {
          prefixId, usedVersion: version, latestVersion, count: 1, versionGap: gap,
        });
      }
    }
  }

  const orphanList = [...orphans.values()].sort((a, b) => b.count - a.count);
  const staleList = [...staleMap.values()].sort((a, b) => b.versionGap - a.versionGap);
  const healthRate = totalAddresses > 0 ? validAddresses / totalAddresses : 1;

  const summaryParts: string[] = [];
  if (orphanList.length > 0) {
    summaryParts.push(`고아 ${orphanList.length}종 (${orphanList.reduce((s, o) => s + o.count, 0)}건)`);
  }
  if (staleList.length > 0) {
    summaryParts.push(`구버전 ${staleList.length}종 (${staleList.reduce((s, o) => s + o.count, 0)}건)`);
  }

  return {
    totalAddresses,
    validAddresses,
    orphans: orphanList,
    staleVersions: staleList,
    healthRate,
    summary: summaryParts.length > 0
      ? `건전성 ${(healthRate * 100).toFixed(1)}% — ${summaryParts.join(", ")}`
      : `건전성 100% — ${totalAddresses}건 모두 유효`,
  };
}
