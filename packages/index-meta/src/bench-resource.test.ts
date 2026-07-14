// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * index-meta 리소스 사용량 벤치마크
 *
 * MetaCodec, DecodeMap, LabelRegistry 등 정보 해석 레이어의 메모리 사용량을 측정한다.
 */

import { describe, it, expect } from 'vitest';
import { MetaCodec } from './meta-codec.js';
import type { DecodeMap, EntityId } from './types.js';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
      kind: 'entity' as const,
      entries: d.entries,
    })),
  };
}

function measureAllocation(factory: () => unknown, count: number = 50): number {
  const warmup: unknown[] = [];
  for (let i = 0; i < 5; i++) warmup.push(factory());
  warmup.length = 0;

  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  const instances: unknown[] = [];
  for (let i = 0; i < count; i++) {
    instances.push(factory());
  }

  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  expect(instances.length).toBe(count);
  return Math.max(0, Math.round((after - before) / count));
}

// ── 1. DecodeMap 와이어 크기 ────────────────────────────────────────────

describe('DecodeMap 와이어 크기 (JSON 직렬화)', () => {
  const cases = [
    { label: '3D×5 entries', dims: 3, entries: 5 },
    { label: '3D×20 entries', dims: 3, entries: 20 },
    { label: '3D×50 entries', dims: 3, entries: 50 },
    { label: '3D×100 entries', dims: 3, entries: 100 },
    { label: '3D×500 entries', dims: 3, entries: 500 },
    { label: '8D×10 entries', dims: 8, entries: 10 },
    { label: '8D×50 entries', dims: 8, entries: 50 },
    { label: '12D×5 entries', dims: 12, entries: 5 },
  ];

  const results: Array<{
    label: string;
    totalEntries: number;
    jsonSize: string;
    addressSpace: string;
  }> = [];

  it.each(cases)('$label', ({ label, dims, entries }) => {
    const dimConfigs = Array.from({ length: dims }, (_, i) => ({
      dimId: `dim_${i}`,
      entries: makeEntries(`d${i}`, entries),
    }));

    const map = buildDecodeMap({ indexId: 'test', versionId: 'v1', dims: dimConfigs });
    const json = JSON.stringify(map);

    results.push({
      label,
      totalEntries: dims * entries,
      jsonSize: fmtBytes(json.length),
      addressSpace: map.size.toExponential(1),
    });
  });

  it('결과 테이블', () => {
    console.log('\n=== DecodeMap JSON 와이어 크기 ===');
    console.table(results);
    console.log('와이어 크기는 entry ID 문자열 길이에 비례. 전송 시 gzip 압축 권장.');
  });
});

// ── 2. MetaCodec 인스턴스 메모리 ────────────────────────────────────────

describe('MetaCodec 인스턴스 메모리', () => {
  const cases = [
    { label: '3D×5', dims: 3, entries: 5 },
    { label: '3D×50', dims: 3, entries: 50 },
    { label: '3D×500', dims: 3, entries: 500 },
    { label: '8D×10', dims: 8, entries: 10 },
    { label: '8D×50', dims: 8, entries: 50 },
    { label: '12D×5', dims: 12, entries: 5 },
  ];

  const results: Array<{
    label: string;
    totalEntries: number;
    codecBytes: string;
    decodeMapJsonBytes: string;
    constructMs: string;
  }> = [];

  it.each(cases)('$label', ({ label, dims, entries }) => {
    const dimConfigs = Array.from({ length: dims }, (_, i) => ({
      dimId: `dim_${i}`,
      entries: makeEntries(`d${i}`, entries),
    }));
    const map = buildDecodeMap({ indexId: 'test', versionId: 'v1', dims: dimConfigs });

    // MetaCodec 메모리
    const codecBytes = measureAllocation(() => new MetaCodec(map), 50);

    // 생성 시간
    const ITER = 5_000;
    const start = performance.now();
    for (let i = 0; i < ITER; i++) void new MetaCodec(map);
    const constructMs = (performance.now() - start) / ITER;

    results.push({
      label,
      totalEntries: dims * entries,
      codecBytes: fmtBytes(codecBytes),
      decodeMapJsonBytes: fmtBytes(JSON.stringify(map).length),
      constructMs:
        constructMs < 1 ? `${(constructMs * 1000).toFixed(0)} µs` : `${constructMs.toFixed(2)} ms`,
    });
  });

  it('결과 테이블', () => {
    console.log('\n=== MetaCodec 인스턴스 메모리 ===');
    console.table(results);
    console.log('내부: DecodeMap(복사) + LabelRegistry(Map×2×d) + PrefixCodec + WeightedIndex');
  });
});

// ── 3. Cross-index 계층 전체 리소스 ─────────────────────────────────────

describe('cross-index 계층 리소스', () => {
  it('SaaS 2레벨 (perm 10×20×50 → access 10K×100)', () => {
    const permMap = buildDecodeMap({
      indexId: 'perm',
      versionId: 'v1',
      dims: [
        { dimId: 'role', entries: makeEntries('role', 10) },
        { dimId: 'action', entries: makeEntries('action', 20) },
        { dimId: 'resource', entries: makeEntries('resource', 50) },
      ],
    });

    const permRefs = Array.from({ length: permMap.size }, (_, i) => `perm_${i}`);
    const accessMap = buildDecodeMap({
      indexId: 'access',
      versionId: 'v1',
      dims: [
        { dimId: 'perm_ref', entries: permRefs },
        { dimId: 'tenant', entries: makeEntries('tenant', 100) },
      ],
    });

    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    const permCodec = new MetaCodec(permMap);
    const accessCodec = new MetaCodec(accessMap);

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;

    const permJson = JSON.stringify(permMap).length;
    const accessJson = JSON.stringify(accessMap).length;

    console.log('\n=== SaaS 2레벨 cross-index 리소스 ===');
    console.log(`perm codec (10×20×50 = 10K):`);
    console.log(`  DecodeMap JSON: ${fmtBytes(permJson)}`);
    console.log(`access codec (10K×100 = 1M):`);
    console.log(`  DecodeMap JSON: ${fmtBytes(accessJson)}`);
    console.log(`  perm_ref entries: ${permRefs.length.toLocaleString()}개 (가장 큰 비용)`);
    console.log(`총 힙 메모리: ${fmtBytes(after - before)}`);

    // 정합성
    const vv = permCodec.encode({ role: 'role_5', action: 'action_10', resource: 'resource_25' });
    expect(permCodec.decode(vv).role).toBe('role_5');
  });
});

// ── 4. 다수 MetaCodec 동시 보유 ─────────────────────────────────────────

describe('다수 MetaCodec 동시 보유', () => {
  it('10개 독립 코덱 (각 3D×20)', () => {
    const maps: DecodeMap[] = [];
    for (let i = 0; i < 10; i++) {
      maps.push(
        buildDecodeMap({
          indexId: `index_${i}`,
          versionId: 'v1',
          dims: [
            { dimId: `d0_${i}`, entries: makeEntries(`i${i}_d0`, 20) },
            { dimId: `d1_${i}`, entries: makeEntries(`i${i}_d1`, 20) },
            { dimId: `d2_${i}`, entries: makeEntries(`i${i}_d2`, 20) },
          ],
        }),
      );
    }

    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    const codecs = maps.map((m) => new MetaCodec(m));

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const total = after - before;

    console.log(`\n=== 10개 독립 MetaCodec (각 3D×20 = 8K) 동시 보유 ===`);
    console.log(`총 메모리: ${fmtBytes(total)}`);
    console.log(`코덱당: ${fmtBytes(Math.round(total / 10))}`);

    expect(codecs.length).toBe(10);
  });

  it('멀티 버전 코덱 (v1~v5, 같은 스키마)', () => {
    const codecs: MetaCodec[] = [];

    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    for (let v = 1; v <= 5; v++) {
      // 버전이 올라갈수록 entries가 약간씩 증가 (headroom 소비)
      const entryCount = 10 + v * 2;
      const map = buildDecodeMap({
        indexId: 'perm',
        versionId: `v${v}`,
        dims: [
          { dimId: 'role', entries: makeEntries('role', entryCount) },
          { dimId: 'action', entries: makeEntries('action', 20) },
          { dimId: 'resource', entries: makeEntries('resource', 50) },
        ],
      });
      codecs.push(new MetaCodec(map));
    }

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const total = after - before;

    console.log(`\n=== 5개 버전 MetaCodec (v1~v5, role 12→20) ===`);
    console.log(`총 메모리: ${fmtBytes(total)}`);
    console.log(`버전당: ${fmtBytes(Math.round(total / 5))}`);

    expect(codecs.length).toBe(5);
  });
});
