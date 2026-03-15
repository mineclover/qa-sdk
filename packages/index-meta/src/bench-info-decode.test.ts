/**
 * 정보 디코딩 종단 벤치마크
 *
 * 우려 사항: 좌표 디코딩(WeightedIndex)은 빠르지만,
 * 실제로 entity 이름까지 해석하는 전체 파이프라인은 얼마나 걸리는가?
 *
 * 파이프라인 레이어:
 *   L1. WeightedIndex.decode       — integer → coords (순수 수학)
 *   L2. LabelRegistry → entityIds  — coords → entity names (Map lookup)
 *   L3. PrefixCodec.decodeToIds    — L1+L2 통합
 *   L4. MetaCodec.decode           — L3 + VersionedValue 검증 + Object.freeze
 *   L5. MetaCodec (cross-index)    — 다단 codec을 체이닝하여 종단 정보 획득
 *
 * 각 레이어의 오버헤드를 분리 측정하여 병목을 식별한다.
 */

import { describe, it, expect } from "vitest";
import {
  WeightedIndex,
  PrefixCodec,
  createLabelRegistry,
  type LabelVersionEntry,
  type EntityId as WiEntityId,
} from "weighted-index";
import { MetaCodec } from "./meta-codec.js";
import type { DecodeMap, EntityId, VersionedValue } from "./types.js";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function bench(fn: () => void, iterations: number) {
  for (let i = 0; i < Math.min(iterations, 1000); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;
  return {
    totalMs,
    opsPerSec: Math.round((iterations / totalMs) * 1000),
    avgNs: Math.round((totalMs / iterations) * 1_000_000),
  };
}

function makeEntries(prefix: string, count: number): EntityId[] {
  return Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);
}

function buildDecodeMap(config: {
  indexId: string;
  versionId: string;
  dims: Array<{ dimId: string; entries: EntityId[] }>;
}): DecodeMap {
  const shape = config.dims.map((d) => d.entries.length);
  const size = shape.reduce((a, b) => a * b, 1);
  return {
    indexId: config.indexId,
    versionId: config.versionId,
    shape,
    size,
    dims: config.dims.map((d) => ({
      dimId: d.dimId,
      snapshotId: `${d.dimId}_snap_1`,
      kind: "entity" as const,
      entries: d.entries,
    })),
  };
}

// ── 시나리오 1: 3D 권한 모델 — 레이어별 오버헤드 분리 ─────────────────────

describe("레이어별 오버헤드 분리 (3D: role×action×resource)", () => {
  const roles = makeEntries("role", 10);
  const actions = makeEntries("action", 20);
  const resources = makeEntries("resource", 50);

  // L1: 순수 WeightedIndex
  const wi = new WeightedIndex([10, 20, 50], ["role", "action", "resource"]);

  // L2: LabelRegistry + PrefixCodec
  const labelDefs: Record<string, LabelVersionEntry<WiEntityId>[]> = {
    role: [{ version: "s1", ids: roles }],
    action: [{ version: "s1", ids: actions }],
    resource: [{ version: "s1", ids: resources }],
  };
  const labelReg = createLabelRegistry(labelDefs);
  const prefixCodec = new PrefixCodec(labelReg, {
    perm: {
      labels: ["role", "action", "resource"],
      versions: [{ version: "v1", labelVersions: { role: "s1", action: "s1", resource: "s1" } }],
    },
  });

  // L4: MetaCodec
  const decodeMap = buildDecodeMap({
    indexId: "perm",
    versionId: "v1",
    dims: [
      { dimId: "role", entries: roles },
      { dimId: "action", entries: actions },
      { dimId: "resource", entries: resources },
    ],
  });
  const codec = new MetaCodec(decodeMap);

  const testCoords = [5, 10, 25];
  const testIdx = wi.encode(testCoords);
  const testVV: VersionedValue = { indexId: "perm", versionId: "v1", value: testIdx };
  const testEntityIds = { role: "role_5", action: "action_10", resource: "resource_25" };

  it("정합성 검증", () => {
    expect(wi.decode(testIdx)).toEqual(testCoords);
    const decoded = codec.decode(testVV);
    expect(decoded).toEqual(testEntityIds);
    const encoded = codec.encode(testEntityIds);
    expect(encoded).toEqual(testVV);
  });

  it("레이어별 decode 성능", () => {
    const ITER = 500_000;
    const outBuf = new Array<number>(3);

    // L1: WeightedIndex.decodeToUnsafe (순수 수학)
    const l1 = bench(() => wi.decodeToUnsafe(testIdx, outBuf), ITER);

    // L1b: WeightedIndex.decode (검증 포함 + 배열 할당)
    const l1b = bench(() => wi.decode(testIdx), ITER);

    // L3: PrefixCodec.decodeToIds (coords→entityIds 포함)
    const l3 = bench(
      () => prefixCodec.decodeToIds({ prefix: "perm", v: "v1", id: testIdx }),
      ITER
    );

    // L4: MetaCodec.decodeValue (Object.freeze 포함)
    const l4v = bench(() => codec.decodeValue(testIdx), ITER);

    // L4: MetaCodec.decode (VersionedValue 검증 + decodeValue)
    const l4 = bench(() => codec.decode(testVV), ITER);

    console.log("\n=== 3D 권한 모델 (10×20×50 = 10,000) — decode 레이어 분리 ===");
    console.log(`L1  WI.decodeToUnsafe:  ${l1.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l1.avgNs).padStart(5)}ns`);
    console.log(`L1b WI.decode (safe):   ${l1b.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l1b.avgNs).padStart(5)}ns`);
    console.log(`L3  PrefixCodec.decode: ${l3.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l3.avgNs).padStart(5)}ns`);
    console.log(`L4v MetaCodec.decodeVal:${l4v.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l4v.avgNs).padStart(5)}ns`);
    console.log(`L4  MetaCodec.decode:   ${l4.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l4.avgNs).padStart(5)}ns`);
    console.log(`\n    오버헤드: WI → MetaCodec = ${l4.avgNs - l1.avgNs}ns 추가`);
  });

  it("레이어별 encode 성능", () => {
    const ITER = 500_000;

    // L1: WeightedIndex.encodeUnsafe
    const l1 = bench(() => wi.encodeUnsafe(testCoords), ITER);

    // L3: PrefixCodec.encodeFromIds
    const l3 = bench(
      () => prefixCodec.encodeFromIds("perm", testEntityIds, "v1"),
      ITER
    );

    // L4: MetaCodec.encode
    const l4 = bench(() => codec.encode(testEntityIds), ITER);

    console.log("\n=== 3D 권한 모델 — encode 레이어 분리 ===");
    console.log(`L1  WI.encodeUnsafe:    ${l1.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l1.avgNs).padStart(5)}ns`);
    console.log(`L3  PrefixCodec.encode: ${l3.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l3.avgNs).padStart(5)}ns`);
    console.log(`L4  MetaCodec.encode:   ${l4.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(l4.avgNs).padStart(5)}ns`);
    console.log(`\n    오버헤드: WI → MetaCodec = ${l4.avgNs - l1.avgNs}ns 추가`);
  });
});

// ── 시나리오 2: 차원 수 증가 시 정보 디코딩 스케일링 ──────────────────────

describe("차원 수 증가 — MetaCodec 정보 디코딩 스케일링", () => {
  const dimCounts = [2, 4, 6, 8, 10, 12];
  const ITER = 200_000;

  const results: Array<{
    dims: number;
    size: string;
    wiDecodeNs: number;
    codecDecodeNs: number;
    overheadNs: number;
    codecEncodeNs: number;
  }> = [];

  it.each(dimCounts)("d=%d (각 5개 엔트리)", (d) => {
    const dims = Array.from({ length: d }, (_, i) => ({
      dimId: `dim_${i}`,
      entries: makeEntries(`d${i}`, 5),
    }));

    const map = buildDecodeMap({ indexId: "test", versionId: "v1", dims });
    const codec = new MetaCodec(map);
    const wi = new WeightedIndex(
      map.shape,
      dims.map((d) => d.dimId)
    );

    // 중앙 좌표로 테스트
    const midIdx = Math.floor(map.size / 2);
    const midVV: VersionedValue = { indexId: "test", versionId: "v1", value: midIdx };
    const decoded = codec.decode(midVV);
    const outBuf = new Array<number>(d);

    const wiDec = bench(() => wi.decodeToUnsafe(midIdx, outBuf), ITER);
    const codecDec = bench(() => codec.decode(midVV), ITER);
    const codecEnc = bench(() => codec.encode(decoded as Record<string, EntityId>), ITER);

    results.push({
      dims: d,
      size: map.size.toExponential(1),
      wiDecodeNs: wiDec.avgNs,
      codecDecodeNs: codecDec.avgNs,
      overheadNs: codecDec.avgNs - wiDec.avgNs,
      codecEncodeNs: codecEnc.avgNs,
    });

    // 라운드트립 검증
    const reEncoded = codec.encode(decoded as Record<string, EntityId>);
    expect(reEncoded.value).toBe(midIdx);
  });

  it("결과 테이블 출력", () => {
    console.log("\n=== 차원 수 증가 — 정보 디코딩 스케일링 (각 5 entries) ===");
    console.table(results);
  });
});

// ── 시나리오 3: 엔트리 수 증가 시 정보 디코딩 스케일링 ────────────────────

describe("엔트리 수 증가 — MetaCodec 정보 디코딩 스케일링", () => {
  const entryCounts = [5, 20, 50, 100, 500];
  const ITER = 200_000;

  const results: Array<{
    entriesPerDim: number;
    size: string;
    codecDecodeNs: number;
    codecEncodeNs: number;
  }> = [];

  it.each(entryCounts)("entries=%d (3차원)", (entryCount) => {
    const dims = [
      { dimId: "role", entries: makeEntries("role", entryCount) },
      { dimId: "action", entries: makeEntries("action", entryCount) },
      { dimId: "resource", entries: makeEntries("resource", entryCount) },
    ];

    const map = buildDecodeMap({ indexId: "test", versionId: "v1", dims });
    const codec = new MetaCodec(map);

    const midIdx = Math.floor(map.size / 2);
    const midVV: VersionedValue = { indexId: "test", versionId: "v1", value: midIdx };
    const decoded = codec.decode(midVV);

    const codecDec = bench(() => codec.decode(midVV), ITER);
    const codecEnc = bench(() => codec.encode(decoded as Record<string, EntityId>), ITER);

    results.push({
      entriesPerDim: entryCount,
      size: map.size.toExponential(1),
      codecDecodeNs: codecDec.avgNs,
      codecEncodeNs: codecEnc.avgNs,
    });

    expect(codec.encode(decoded as Record<string, EntityId>).value).toBe(midIdx);
  });

  it("결과 테이블 출력", () => {
    console.log("\n=== 엔트리 수 증가 — 3D 정보 디코딩 (entries per dim) ===");
    console.table(results);
  });
});

// ── 시나리오 4: Cross-index 종단 정보 디코딩 ─────────────────────────────

describe("cross-index 종단 정보 디코딩", () => {
  // L0: format(3) × lang(4) = 12
  const l0Map = buildDecodeMap({
    indexId: "doc_meta",
    versionId: "v1",
    dims: [
      { dimId: "format", entries: ["pdf", "html", "epub"] },
      { dimId: "lang", entries: ["ko", "en", "ja", "zh"] },
    ],
  });
  const l0Codec = new MetaCodec(l0Map);

  // L1: doc_meta_ref(12) × priority(5) = 60
  const l1Entries = Array.from({ length: l0Map.size }, (_, i) => `doc_${i}`);
  const l1Map = buildDecodeMap({
    indexId: "article",
    versionId: "v1",
    dims: [
      { dimId: "doc_meta_ref", entries: l1Entries },
      { dimId: "priority", entries: ["critical", "high", "medium", "low", "none"] },
    ],
  });
  const l1Codec = new MetaCodec(l1Map);

  // 종단 decode: article index → doc_meta_ref entityId → parse ref index → decode to format+lang
  function decodeE2E(articleIdx: number) {
    const articleVV: VersionedValue = { indexId: "article", versionId: "v1", value: articleIdx };
    const articleInfo = l1Codec.decode(articleVV);
    // doc_meta_ref는 "doc_N" 형태, N이 L0의 value
    const docMetaValue = parseInt(articleInfo.doc_meta_ref.substring(4));
    const docMetaVV: VersionedValue = { indexId: "doc_meta", versionId: "v1", value: docMetaValue };
    const docMetaInfo = l0Codec.decode(docMetaVV);
    return { ...docMetaInfo, priority: articleInfo.priority };
  }

  function encodeE2E(format: string, lang: string, priority: string): number {
    const docMetaVV = l0Codec.encode({ format, lang });
    const docMetaRef = `doc_${docMetaVV.value}`;
    return l1Codec.encode({ doc_meta_ref: docMetaRef, priority }).value;
  }

  it("정합성 검증", () => {
    const idx = encodeE2E("html", "ko", "high");
    const info = decodeE2E(idx);
    expect(info).toEqual({ format: "html", lang: "ko", priority: "high" });
  });

  it("성능 측정", () => {
    const testIdx = encodeE2E("epub", "en", "medium");
    const ITER = 300_000;

    // 단일 레벨 decode (L1만)
    const singleVV: VersionedValue = { indexId: "article", versionId: "v1", value: testIdx };
    const single = bench(() => l1Codec.decode(singleVV), ITER);

    // 종단 decode (L1 → L0)
    const e2e = bench(() => decodeE2E(testIdx), ITER);

    // 종단 encode
    const e2eEnc = bench(() => encodeE2E("epub", "en", "medium"), ITER);

    console.log("\n=== Cross-index 종단 정보 디코딩 (2레벨: 3×4 → 12×5 = 60) ===");
    console.log(`single decode:  ${single.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(single.avgNs).padStart(5)}ns`);
    console.log(`E2E decode:     ${e2e.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(e2e.avgNs).padStart(5)}ns`);
    console.log(`E2E encode:     ${e2eEnc.opsPerSec.toLocaleString().padStart(14)} ops/s  ${String(e2eEnc.avgNs).padStart(5)}ns`);
  });
});

// ── 시나리오 5: SaaS 대규모 종단 정보 디코딩 ─────────────────────────────

describe("SaaS 대규모 종단 정보 디코딩", () => {
  // L0: role(10) × action(20) × resource(50) = 10,000
  const roles = makeEntries("role", 10);
  const actions = makeEntries("action", 20);
  const resources = makeEntries("resource", 50);

  const l0Map = buildDecodeMap({
    indexId: "perm",
    versionId: "v1",
    dims: [
      { dimId: "role", entries: roles },
      { dimId: "action", entries: actions },
      { dimId: "resource", entries: resources },
    ],
  });
  const l0Codec = new MetaCodec(l0Map);

  // L1: perm_ref(10000) × tenant(100) = 1,000,000
  const permRefs = Array.from({ length: l0Map.size }, (_, i) => `perm_${i}`);
  const tenants = makeEntries("tenant", 100);

  const l1Map = buildDecodeMap({
    indexId: "access",
    versionId: "v1",
    dims: [
      { dimId: "perm_ref", entries: permRefs },
      { dimId: "tenant", entries: tenants },
    ],
  });
  const l1Codec = new MetaCodec(l1Map);

  function decodeE2E(accessIdx: number) {
    const accessVV: VersionedValue = { indexId: "access", versionId: "v1", value: accessIdx };
    const accessInfo = l1Codec.decode(accessVV);
    const permValue = parseInt(accessInfo.perm_ref.substring(5));
    const permVV: VersionedValue = { indexId: "perm", versionId: "v1", value: permValue };
    const permInfo = l0Codec.decode(permVV);
    return { ...permInfo, tenant: accessInfo.tenant };
  }

  function encodeE2E(role: string, action: string, resource: string, tenant: string): number {
    const permVV = l0Codec.encode({ role, action, resource });
    const permRef = `perm_${permVV.value}`;
    return l1Codec.encode({ perm_ref: permRef, tenant }).value;
  }

  it("정합성 검증", () => {
    const idx = encodeE2E("role_5", "action_10", "resource_25", "tenant_50");
    const info = decodeE2E(idx);
    expect(info).toEqual({
      role: "role_5",
      action: "action_10",
      resource: "resource_25",
      tenant: "tenant_50",
    });
  });

  it("성능 측정", () => {
    const testIdx = encodeE2E("role_5", "action_10", "resource_25", "tenant_50");
    const ITER = 200_000;

    // L0 단일 decode
    const l0VV: VersionedValue = { indexId: "perm", versionId: "v1", value: 4524 };
    const l0Dec = bench(() => l0Codec.decode(l0VV), ITER);

    // L1 단일 decode
    const l1VV: VersionedValue = { indexId: "access", versionId: "v1", value: testIdx };
    const l1Dec = bench(() => l1Codec.decode(l1VV), ITER);

    // 종단 decode
    const e2eDec = bench(() => decodeE2E(testIdx), ITER);

    // 종단 encode
    const e2eEnc = bench(
      () => encodeE2E("role_5", "action_10", "resource_25", "tenant_50"),
      ITER
    );

    console.log("\n=== SaaS 대규모 종단 (10×20×50 → 10K×100 = 1,000,000) ===");
    console.log(`L0 perm decode:   ${l0Dec.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(l0Dec.avgNs).padStart(5)}ns`);
    console.log(`L1 access decode: ${l1Dec.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(l1Dec.avgNs).padStart(5)}ns`);
    console.log(`E2E decode:       ${e2eDec.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(e2eDec.avgNs).padStart(5)}ns`);
    console.log(`E2E encode:       ${e2eEnc.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(e2eEnc.avgNs).padStart(5)}ns`);
    console.log(`L1 size:          ${l1Map.size.toLocaleString()}`);
  });
});

// ── 시나리오 6: matchRanges 포함 종합 워크로드 ───────────────────────────

describe("종합 워크로드: encode → decode → matchRanges", () => {
  const map = buildDecodeMap({
    indexId: "perm",
    versionId: "v1",
    dims: [
      { dimId: "role", entries: makeEntries("role", 10) },
      { dimId: "action", entries: makeEntries("action", 20) },
      { dimId: "resource", entries: makeEntries("resource", 50) },
    ],
  });
  const codec = new MetaCodec(map);

  it("혼합 워크로드 성능", () => {
    const ITER = 100_000;
    const entityIds = { role: "role_5", action: "action_10", resource: "resource_25" };

    // 전형적 워크로드: encode → decode → matchRanges
    const mixed = bench(() => {
      const vv = codec.encode(entityIds);
      const decoded = codec.decode(vv);
      codec.matchRanges({ role: decoded.role, action: null, resource: null });
    }, ITER);

    // encode only
    const enc = bench(() => codec.encode(entityIds), ITER);
    // decode only
    const vv = codec.encode(entityIds);
    const dec = bench(() => codec.decode(vv), ITER);
    // matchRanges only
    const mr = bench(
      () => codec.matchRanges({ role: "role_5", action: null, resource: null }),
      ITER
    );

    console.log("\n=== 종합 워크로드 (10×20×50) ===");
    console.log(`encode:       ${enc.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(enc.avgNs).padStart(5)}ns`);
    console.log(`decode:       ${dec.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(dec.avgNs).padStart(5)}ns`);
    console.log(`matchRanges:  ${mr.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(mr.avgNs).padStart(5)}ns`);
    console.log(`mixed (E+D+R):${mixed.opsPerSec.toLocaleString().padStart(12)} ops/s  ${String(mixed.avgNs).padStart(5)}ns`);
  });
});
