// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * bench-bit-optimization.test.ts — BitIndex 최적화 성능 비교
 *
 * PermissionCodec의 기존 방식(WeightedIndex full decode)과
 * 신규 방식(BitIndex extractDim 필터)의 성능을 비교한다.
 *
 * ── 비교 대상 ─────────────────────────────────────────────────────────────
 *
 *   기존: listGrantsDecoded(mask) → 전체 순회, 매 slot마다 full decode
 *   신규: filterGrants(mask, conditions) → toBitMaskSet + extractDim 사전 필터
 *
 *   기존 필터: listGrantsDecoded(mask).filter(d => d.service === X)
 *   신규 필터: filterGrants(mask, { service: X })
 */

import { describe, it, expect } from 'vitest';
import { PermissionCodec, PermissionView } from './permission-codec.js';
import { hasBit } from 'weighted-index';

// ── 대규모 코덱 (실사용 급) ──────────────────────────────────────────────

const LARGE_DIMS = {
  services: Array.from({ length: 20 }, (_, i) => `svc-${i}`),
  types: ['api', 'page', 'action', 'webhook'],
  resources: Array.from({ length: 50 }, (_, i) => `res/${i}`),
  actions: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'LIST'],
};
// 20 × 4 × 50 × 8 = 32,000 slots

function measure(
  fn: () => void,
  iterations: number,
): { totalMs: number; opsPerSec: string; avgNs: string } {
  // warmup
  for (let i = 0; i < Math.min(10, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;

  const opsPerSec = Math.round((iterations / totalMs) * 1000).toLocaleString();
  const avgNs = Math.round((totalMs / iterations) * 1_000_000).toLocaleString();
  return { totalMs, opsPerSec, avgNs };
}

// ═════════════════════════════════════════════════════════════════════════════
//  §1 기본 성능: encode / decode / extractDim 비교
// ═════════════════════════════════════════════════════════════════════════════

describe('§1 기본 연산 성능', () => {
  const codec = new PermissionCodec('v1', LARGE_DIMS);

  it('WeightedIndex.decode vs BitIndex.extractDim (단일 차원)', () => {
    const iters = 100_000;

    // 중간 주소
    const addr = Math.floor(codec.size / 2);
    const biPacked = codec.bridge.toBit(addr);

    // WI full decode → 첫 차원만 사용
    const wiResult = measure(() => {
      const coords = codec.index.decode(addr);
      const _svc = coords[0]; // service dim
    }, iters);

    // BI extractDim → 첫 차원만
    const biResult = measure(() => {
      const _svc = codec.bitIndex.extractDim(biPacked, 0);
    }, iters);

    console.log(`\n=== §1 단일 차원 추출 (${iters.toLocaleString()} iterations) ===`);
    console.log(`WI decode (full):     ${wiResult.opsPerSec} ops/s (${wiResult.avgNs}ns)`);
    console.log(`BI extractDim (O(1)): ${biResult.opsPerSec} ops/s (${biResult.avgNs}ns)`);

    expect(true).toBe(true);
  });

  it('bridge 변환 비용: toBit / toWeighted', () => {
    const iters = 100_000;
    const addr = Math.floor(codec.size / 2);
    const biPacked = codec.bridge.toBit(addr);

    const toBitResult = measure(() => {
      codec.bridge.toBitUnsafe(addr);
    }, iters);
    const toWiResult = measure(() => {
      codec.bridge.toWeightedUnsafe(biPacked);
    }, iters);

    console.log(`\n=== §1 bridge 변환 비용 ===`);
    console.log(`toBit (WI→BI):      ${toBitResult.opsPerSec} ops/s (${toBitResult.avgNs}ns)`);
    console.log(`toWeighted (BI→WI): ${toWiResult.opsPerSec} ops/s (${toWiResult.avgNs}ns)`);

    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  §2 listGrantsDecoded vs filterGrants (핵심 비교)
// ═════════════════════════════════════════════════════════════════════════════

describe('§2 필터 성능: listGrantsDecoded().filter vs filterGrants', () => {
  const codec = new PermissionCodec('v1', LARGE_DIMS);

  // 50% 부여 (16,000 grants)
  const mask = codec.createMask();
  for (let i = 0; i < codec.size; i += 2) {
    const { service, type, resource, action } = codec.decode(i);
    codec.grantRaw(mask, service, type, resource, action);
  }
  const grantCount = 16_000;

  it('단일 service 필터 (sparse: 결과 ~800건)', () => {
    const iters = 100;

    // 기존: 전체 decode + JS filter
    const oldResult = measure(() => {
      const all = codec.listGrantsDecoded(mask);
      const _filtered = all.filter((d) => d.service === 'svc-5');
    }, iters);

    // 신규: filterGrants (BitIndex extractDim 사전 필터)
    const newResult = measure(() => {
      const _filtered = codec.filterGrants(mask, { service: 'svc-5' });
    }, iters);

    // 기존 결과 확인
    const oldFiltered = codec.listGrantsDecoded(mask).filter((d) => d.service === 'svc-5');
    const newFiltered = codec.filterGrants(mask, { service: 'svc-5' });
    expect(newFiltered).toHaveLength(oldFiltered.length);

    console.log(
      `\n=== §2 단일 service 필터 (${grantCount.toLocaleString()} grants, ${iters} iterations) ===`,
    );
    console.log(`listGrantsDecoded+filter: ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(`filterGrants:             ${newResult.opsPerSec} ops/s (${newResult.avgNs}ns)`);

    expect(true).toBe(true);
  });

  it('service + type 복합 필터 (결과 ~200건)', () => {
    const iters = 100;

    const oldResult = measure(() => {
      const all = codec.listGrantsDecoded(mask);
      const _f = all.filter((d) => d.service === 'svc-5' && d.type === 'api');
    }, iters);

    const newResult = measure(() => {
      const _f = codec.filterGrants(mask, { service: 'svc-5', type: 'api' });
    }, iters);

    const oldFiltered = codec
      .listGrantsDecoded(mask)
      .filter((d) => d.service === 'svc-5' && d.type === 'api');
    const newFiltered = codec.filterGrants(mask, { service: 'svc-5', type: 'api' });
    expect(newFiltered).toHaveLength(oldFiltered.length);

    console.log(`\n=== §2 service+type 복합 필터 (${grantCount.toLocaleString()} grants) ===`);
    console.log(`listGrantsDecoded+filter: ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(`filterGrants:             ${newResult.opsPerSec} ops/s (${newResult.avgNs}ns)`);

    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  §3 toBitMaskSet 변환 비용
// ═════════════════════════════════════════════════════════════════════════════

describe('§3 toBitMaskSet 변환 비용', () => {
  const codec = new PermissionCodec('v1', LARGE_DIMS);

  it('변환 + 필터 vs 전체 decode (단발 비용 포함)', () => {
    const mask = codec.createMask();
    // 전체 부여
    for (let i = 0; i < codec.size; i++) {
      const { service, type, resource, action } = codec.decode(i);
      codec.grantRaw(mask, service, type, resource, action);
    }

    const iters = 50;

    // 전체 decode (기존)
    const oldResult = measure(() => {
      const all = codec.listGrantsDecoded(mask);
      const _f = all.filter((d) => d.service === 'svc-10');
    }, iters);

    // toBitMaskSet (1회) + filterByLabel (반복)
    const convertResult = measure(() => {
      const _set = codec.toBitMaskSet(mask);
    }, iters);

    // filterGrants (변환 + 필터 통합)
    const integratedResult = measure(() => {
      const _f = codec.filterGrants(mask, { service: 'svc-10' });
    }, iters);

    // BitMaskSet을 캐시한 경우 (변환 1회 + 필터 N회)
    const cachedSet = codec.toBitMaskSet(mask);
    const cachedResult = measure(() => {
      const _f = cachedSet.filterByDim(0, 11); // svc-10 = 1-based 11
    }, iters * 10);

    console.log(
      `\n=== §3 변환 비용 분석 (${codec.size.toLocaleString()} slots, ${iters} iterations) ===`,
    );
    console.log(`listGrantsDecoded+filter: ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(
      `toBitMaskSet (변환만):    ${convertResult.opsPerSec} ops/s (${convertResult.avgNs}ns)`,
    );
    console.log(
      `filterGrants (통합):      ${integratedResult.opsPerSec} ops/s (${integratedResult.avgNs}ns)`,
    );
    console.log(
      `캐시된 BitMaskSet.filter: ${cachedResult.opsPerSec} ops/s (${cachedResult.avgNs}ns)`,
    );

    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  §4 규모별 스케일링
// ═════════════════════════════════════════════════════════════════════════════

describe('§4 규모별 스케일링', () => {
  const scales = [
    {
      label: '소형 (144)',
      dims: {
        services: Array.from({ length: 3 }, (_, i) => `s${i}`),
        types: ['api', 'page', 'action'],
        resources: Array.from({ length: 4 }, (_, i) => `r${i}`),
        actions: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    },
    {
      label: '중형 (4,000)',
      dims: {
        services: Array.from({ length: 10 }, (_, i) => `s${i}`),
        types: ['api', 'page', 'action', 'webhook'],
        resources: Array.from({ length: 20 }, (_, i) => `r${i}`),
        actions: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      },
    },
    { label: '대형 (32,000)', dims: LARGE_DIMS },
  ];

  it('결과 테이블', () => {
    const iters = 50;
    const rows: {
      label: string;
      size: number;
      oldOps: string;
      newOps: string;
      cachedOps: string;
    }[] = [];

    for (const { label, dims } of scales) {
      const codec = new PermissionCodec('v1', dims);
      const mask = codec.createMask();
      // 50% 부여
      for (let i = 0; i < codec.size; i += 2) {
        const { service, type, resource, action } = codec.decode(i);
        codec.grantRaw(mask, service, type, resource, action);
      }

      const targetSvc = dims.services[Math.floor(dims.services.length / 2)];

      const old = measure(() => {
        codec.listGrantsDecoded(mask).filter((d) => d.service === targetSvc);
      }, iters);

      const newR = measure(() => {
        codec.filterGrants(mask, { service: targetSvc });
      }, iters);

      const cached = codec.toBitMaskSet(mask);
      const svcIdx = Math.floor(dims.services.length / 2) + 1;
      const cachedR = measure(() => {
        cached.filterByDim(0, svcIdx);
      }, iters * 10);

      rows.push({
        label,
        size: codec.size,
        oldOps: old.opsPerSec,
        newOps: newR.opsPerSec,
        cachedOps: cachedR.opsPerSec,
      });
    }

    console.log('\n=== §4 규모별 스케일링 ===');
    console.table(rows);

    expect(rows).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  §5 직렬화 성능: Uint8Array vs BitMaskSet Base64
// ═════════════════════════════════════════════════════════════════════════════

describe('§5 직렬화 성능', () => {
  const codec = new PermissionCodec('v1', LARGE_DIMS);

  it('Uint8Array (dense) vs BitMaskSet Base64 (sparse) 크기 비교', () => {
    // sparse: 1% 부여
    const sparseMask = codec.createMask();
    for (let i = 0; i < 320; i++) {
      const idx = Math.floor(Math.random() * codec.size);
      const { service, type, resource, action } = codec.decode(idx);
      codec.grantRaw(sparseMask, service, type, resource, action);
    }

    // dense: 90% 부여
    const denseMask = codec.createMask();
    for (let i = 0; i < codec.size; i++) {
      if (Math.random() < 0.9) {
        const { service, type, resource, action } = codec.decode(i);
        codec.grantRaw(denseMask, service, type, resource, action);
      }
    }

    const sparseSet = codec.toBitMaskSet(sparseMask);
    const denseSet = codec.toBitMaskSet(denseMask);

    const sparseUint8Size = Math.ceil(codec.size / 8); // 항상 고정
    const sparseSetB64Size = sparseSet.toBase64().length;
    const denseSetB64Size = denseSet.toBase64().length;

    console.log(`\n=== §5 직렬화 크기 비교 (${codec.size.toLocaleString()} slots) ===`);
    console.log(`Uint8Array (항상):        ${sparseUint8Size} bytes`);
    console.log(
      `BitMaskSet sparse (1%):   ${sparseSetB64Size} chars (${sparseSet.size}건, ${sparseSet.size * 4} bytes raw)`,
    );
    console.log(
      `BitMaskSet dense (90%):   ${denseSetB64Size} chars (${denseSet.size}건, ${denseSet.size * 4} bytes raw)`,
    );
    console.log(
      `→ sparse에서 BitMaskSet 유리: ${sparseSetB64Size < sparseUint8Size ? 'YES' : 'NO'} (${sparseSet.size * 4} vs ${sparseUint8Size})`,
    );
    console.log(
      `→ dense에서 Uint8Array 유리:  ${denseSet.size * 4 > sparseUint8Size ? 'YES' : 'NO'} (${denseSet.size * 4} vs ${sparseUint8Size})`,
    );

    // sparse에서는 BitMaskSet이 작을 수 있음 (Set 크기 × 4 < mask 크기)
    // dense에서는 Uint8Array가 항상 작음
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  §6 PermissionView 캐시 레이어 성능
// ═════════════════════════════════════════════════════════════════════════════

describe('§6 PermissionView 캐시 레이어 성능', () => {
  const codec = new PermissionCodec('v1', LARGE_DIMS);

  // 50% 부여
  const mask = codec.createMask();
  for (let i = 0; i < codec.size; i += 2) {
    const { service, type, resource, action } = codec.decode(i);
    codec.grantRaw(mask, service, type, resource, action);
  }

  it('createView 비용 + 반복 필터 비교', () => {
    const iters = 100;

    // 기존: 매번 listGrantsDecoded + filter
    const oldResult = measure(() => {
      codec.listGrantsDecoded(mask).filter((d) => d.service === 'svc-5');
    }, iters);

    // filterGrants: 매번 toBitMaskSet 포함
    const fgResult = measure(() => {
      codec.filterGrants(mask, { service: 'svc-5' });
    }, iters);

    // PermissionView: 1회 createView + N회 filter
    const createStart = performance.now();
    const view = codec.createView(mask);
    const createMs = performance.now() - createStart;

    const viewResult = measure(() => {
      view.filterByService('svc-5');
    }, iters);

    console.log(`\n=== §6 PermissionView 캐시 레이어 (${iters} filter iterations) ===`);
    console.log(`listGrantsDecoded+filter: ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(`filterGrants (매번 변환): ${fgResult.opsPerSec} ops/s (${fgResult.avgNs}ns)`);
    console.log(`createView (1회 비용):    ${createMs.toFixed(2)}ms`);
    console.log(`view.filterByService:     ${viewResult.opsPerSec} ops/s (${viewResult.avgNs}ns)`);
    console.log(
      `→ view가 기존 대비:       ${(Number(viewResult.opsPerSec.replace(/,/g, '')) / Number(oldResult.opsPerSec.replace(/,/g, ''))).toFixed(1)}× 빠름`,
    );

    expect(true).toBe(true);
  });

  it('복합 필터 N회 반복 — view 압승 구간', () => {
    const view = codec.createView(mask);
    const iters = 200;

    const conditions = [
      { service: 'svc-0' },
      { service: 'svc-5', type: 'api' },
      { action: 'GET' },
      { type: 'webhook', action: 'POST' },
      { service: 'svc-10', type: 'page', action: 'DELETE' },
    ];

    // 기존: 5개 조건 × N회
    const oldResult = measure(() => {
      for (const cond of conditions) {
        const all = codec.listGrantsDecoded(mask);
        all.filter((d) => {
          for (const [k, v] of Object.entries(cond)) {
            if (d[k as keyof typeof d] !== v) return false;
          }
          return true;
        });
      }
    }, iters);

    // view: 5개 조건 × N회
    const viewResult = measure(() => {
      for (const cond of conditions) {
        view.filter(cond);
      }
    }, iters);

    console.log(`\n=== §6 복합 필터 5조건 × ${iters}회 ===`);
    console.log(`기존 (listGrants+filter):  ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(`PermissionView.filter:     ${viewResult.opsPerSec} ops/s (${viewResult.avgNs}ns)`);
    console.log(
      `→ view가 기존 대비:        ${(Number(viewResult.opsPerSec.replace(/,/g, '')) / Number(oldResult.opsPerSec.replace(/,/g, ''))).toFixed(1)}× 빠름`,
    );

    expect(true).toBe(true);
  });

  it('check O(1) — view vs codec.checkRaw', () => {
    const view = codec.createView(mask);
    const iters = 100_000;

    // 기존: codec.checkRaw (WI encode + hasBit)
    const oldResult = measure(() => {
      codec.checkRaw(mask, 'svc-5', 'api', 'res/10', 'GET');
    }, iters);

    // view.check (BI encode + Set.has)
    const viewResult = measure(() => {
      view.check('svc-5', 'api', 'res/10', 'GET');
    }, iters);

    console.log(`\n=== §6 check O(1) 비교 (${iters.toLocaleString()} iterations) ===`);
    console.log(`codec.checkRaw (WI+hasBit): ${oldResult.opsPerSec} ops/s (${oldResult.avgNs}ns)`);
    console.log(
      `view.check (BI+Set.has):    ${viewResult.opsPerSec} ops/s (${viewResult.avgNs}ns)`,
    );

    expect(true).toBe(true);
  });
});
