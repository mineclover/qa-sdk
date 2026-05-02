#!/usr/bin/env tsx
/**
 * 새 prefix 7종 — 카탈로그 구조 순회 기반 수집 테스트.
 *
 * generateSyntheticEvents와 동일한 합(sum) 전략:
 *   각 axis의 모든 entry를 최소 1회 관측, 나머지 axis는 첫 entry 고정.
 *   총 이벤트 = Σ(axis entries count)  (곱이 아닌 합)
 *
 * prefix_ref dim은 refEntries 첫 값 자동 주입.
 * table_ref dim은 스킵.
 */

import { DEMO_CATALOG, encodePrefixByValue, decodePrefix, latestPrefixVersion } from "../src/index.js";
import type { PrefixDef, DimRef, VersionedAxis } from "../src/demo-catalog.js";

const INGEST_URL = process.env.INGEST_URL ?? "http://localhost:3200";
const NEW_PREFIXES = [
  "version_state", "metric_aggregate", "validation_event",
  "resource_lifecycle", "test_coverage", "cli_tracking", "tag_lifecycle",
] as const;

// ── 카탈로그 구조 순회 ──────────────────────────────────────────

interface SyntheticEvent {
  prefix: string;
  eventKey: string;
  dims: Record<string, string | number>;
}

function traversePrefix(prefixId: string): SyntheticEvent[] {
  const prefix = (DEMO_CATALOG.prefixes as Record<string, PrefixDef>)[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);

  const version = latestPrefixVersion(DEMO_CATALOG, prefixId);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`No version ${version} for ${prefixId}`);

  // 1. 차원 분류: axis / prefix_ref / table_ref
  const axisDims: Array<{ label: string; axisId: string; entries: readonly string[] }> = [];
  const refDims: Array<{ label: string; firstValue: number }> = [];

  for (const [label, dimRef] of Object.entries(prefix.dims)) {
    const dr = dimRef as DimRef;
    if (dr.kind === "axis") {
      const axis = (DEMO_CATALOG.axes as Record<string, VersionedAxis>)[dr.axisId];
      if (!axis) continue;
      const axisVer = vdef.axisVersions[label] ?? vdef.axisVersions[dr.axisId];
      const snap = axisVer ? axis.versions[axisVer] : Object.values(axis.versions).pop();
      if (!snap?.entries) continue;
      axisDims.push({ label, axisId: dr.axisId, entries: snap.entries });
    } else if (dr.kind === "prefix_ref") {
      // refEntries에서 첫 번째 값
      const re = vdef.refEntries?.[label];
      const firstVal = re?.values?.[0] ?? 0;
      refDims.push({ label, firstValue: firstVal });
    }
    // table_ref → 스킵
  }

  if (axisDims.length === 0) return [];

  // 2. 합(sum) 전략: base(각 axis 첫 entry) + 각 axis entry 순회
  const baseDims: Record<string, string | number> = {};
  for (const ad of axisDims) baseDims[ad.label] = ad.entries[0];
  for (const rd of refDims) baseDims[rd.label] = rd.firstValue;

  const events: SyntheticEvent[] = [];
  for (const ad of axisDims) {
    for (const entry of ad.entries) {
      const dims = { ...baseDims, [ad.label]: entry };
      events.push({
        prefix: prefixId,
        eventKey: `${prefixId}.${ad.label}.${entry}`,
        dims,
      });
    }
  }

  return events;
}

// ── 인코딩 + 라운드트립 ────────────────────────────────────────

interface EncodedEvent {
  event: SyntheticEvent;
  version: string;
  address: number;
  serialized: string;
  roundTripOk: boolean;
  mismatch?: { key: string; expected: string | number; got: string | number };
}

function encodeAndVerify(events: SyntheticEvent[]): EncodedEvent[] {
  return events.map(event => {
    const version = latestPrefixVersion(DEMO_CATALOG, event.prefix);
    const address = encodePrefixByValue(DEMO_CATALOG, event.prefix, version, event.dims);
    const serialized = `${event.prefix}:${version}:${address}`;

    const rawDecoded = decodePrefix(DEMO_CATALOG, event.prefix, version, address);
    const decoded: Record<string, string | number> = {};
    for (const [key, val] of Object.entries(rawDecoded)) {
      decoded[key] = typeof val === "object" && val !== null && "value" in val
        ? (val as { value: string | number }).value
        : val as string | number;
    }

    let roundTripOk = true;
    let mismatch: EncodedEvent["mismatch"];
    for (const [key, val] of Object.entries(event.dims)) {
      if (decoded[key] !== val) {
        roundTripOk = false;
        mismatch = { key, expected: val, got: decoded[key] };
        break;
      }
    }

    return { event, version, address, serialized, roundTripOk, mismatch };
  });
}

// ── TransmissionEnvelope 구성 ───────────────────────────────────

function buildEnvelope(encoded: EncodedEvent[]) {
  const now = new Date().toISOString();
  const batch = Date.now().toString(36);
  const sessionId = `ses_npfx_${batch}`;

  const records = encoded.map((e, i) => {
    const addressContext: Record<string, string> = {
      [e.event.prefix]: e.serialized,
    };
    if ("svc_ref" in e.event.dims) {
      const svcVer = latestPrefixVersion(DEMO_CATALOG, "service");
      addressContext.service = `service:${svcVer}:${e.event.dims.svc_ref}`;
    }

    return {
      log_id: `log_npfx_${batch}_${i}`,
      timestamp: now,
      trace_id: `trc_npfx_${batch}`,
      span_id: `spn_npfx_${batch}_${i}`,
      record_kind: "log",
      event_key: e.event.eventKey,
      event_version: "001",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: false,
      payload_masked_fields: [] as string[],
      payload: { source: "catalog-traverse", prefix: e.event.prefix, dims: e.event.dims },
      qa_session_id: sessionId,
      address_context: addressContext,
    };
  });

  return {
    transmission_id: `tx_npfx_${batch}`,
    sent_at: now,
    owner: { owner_type: "agent", owner_id: "catalog-traverse" },
    source: { service_name: "cli", sdk_name: "@qa-sdk/cli", sdk_version: "0.1.0" },
    runtime: { platform: "node" },
    build: { env: "dev" },
    records,
  };
}

// ── 전송 ────────────────────────────────────────────────────────

async function sendToIngest(envelope: ReturnType<typeof buildEnvelope>): Promise<boolean> {
  try {
    const res = await fetch(`${INGEST_URL}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status}: ${await res.text()}`);
      return false;
    }
    const data = await res.json() as Record<string, unknown>;
    console.log(`  accepted: ${data.accepted}, records: ${data.record_count ?? envelope.records.length}`);
    return true;
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.cause?.code === "ECONNREFUSED") {
      console.log(`  ingest-server 미실행 (${INGEST_URL}) — 로컬 검증만 수행`);
    } else {
      console.error(`  전송 실패: ${err.message}`);
    }
    return false;
  }
}

// ── main ────────────────────────────────────────────────────────

async function main() {
  console.log("══ 카탈로그 구조 순회 — 새 Prefix 수집 ══\n");

  // 1. 구조 순회로 합성 이벤트 생성
  const allEvents: SyntheticEvent[] = [];
  const prefixStats: Array<{ prefix: string; axisDimCount: number; eventCount: number; axes: string[] }> = [];

  for (const pfx of NEW_PREFIXES) {
    const events = traversePrefix(pfx);
    allEvents.push(...events);

    // 축 정보 수집
    const prefix = (DEMO_CATALOG.prefixes as Record<string, PrefixDef>)[pfx];
    const axisLabels = Object.entries(prefix.dims)
      .filter(([, d]) => (d as DimRef).kind === "axis")
      .map(([l]) => l);

    prefixStats.push({
      prefix: pfx,
      axisDimCount: axisLabels.length,
      eventCount: events.length,
      axes: axisLabels,
    });
  }

  // 2. 구조 요약
  console.log("── 구조 순회 결과 ──\n");
  for (const s of prefixStats) {
    console.log(`  ${s.prefix}  ${s.axisDimCount}D  ${s.eventCount}건  [${s.axes.join(" × ")}]`);
  }
  console.log(`\n  합계: ${allEvents.length}건 (${NEW_PREFIXES.length} prefix)\n`);

  // 3. 인코딩 + 라운드트립
  console.log("── 인코딩 + 라운드트립 ──\n");
  const encoded = encodeAndVerify(allEvents);

  let failCount = 0;
  const byPrefix = new Map<string, EncodedEvent[]>();
  for (const e of encoded) {
    if (!byPrefix.has(e.event.prefix)) byPrefix.set(e.event.prefix, []);
    byPrefix.get(e.event.prefix)!.push(e);
    if (!e.roundTripOk) failCount++;
  }

  for (const [prefix, events] of byPrefix) {
    const ok = events.filter(e => e.roundTripOk).length;
    const total = events.length;
    const addrs = events.map(e => e.address);
    const uniqueAddrs = new Set(addrs).size;
    const status = ok === total ? "OK" : "FAIL";

    console.log(`  [${status}] ${prefix}  ${ok}/${total} 성공  주소 ${uniqueAddrs}개 (${Math.min(...addrs)}~${Math.max(...addrs)})`);

    if (ok < total) {
      for (const e of events.filter(e => !e.roundTripOk)) {
        console.log(`    ✗ ${e.serialized}: ${e.mismatch?.key} expected=${e.mismatch?.expected} got=${e.mismatch?.got}`);
      }
    }
  }

  console.log(`\n  라운드트립: ${encoded.length - failCount}/${encoded.length} 성공`);

  if (failCount > 0) {
    console.error(`\n${failCount}건 실패 — 전송 중단`);
    process.exit(1);
  }

  // 4. 전송
  console.log("\n── Ingest 전송 ──\n");
  const envelope = buildEnvelope(encoded);
  console.log(`  transmission: ${envelope.transmission_id}`);
  console.log(`  records: ${envelope.records.length}`);
  const sent = await sendToIngest(envelope);

  // 5. address_context 샘플
  console.log("\n── address_context 샘플 (prefix별 1건) ──\n");
  const seen = new Set<string>();
  for (const rec of envelope.records) {
    const pfx = (rec.payload as { prefix: string }).prefix;
    if (seen.has(pfx)) continue;
    seen.add(pfx);
    console.log(`  ${rec.event_key}`);
    console.log(`    ${JSON.stringify(rec.address_context)}`);
  }

  console.log(`\n══ 완료 ══ (전송: ${sent ? "성공" : "로컬만"}, 이벤트: ${encoded.length}건, 라운드트립: 100%)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
