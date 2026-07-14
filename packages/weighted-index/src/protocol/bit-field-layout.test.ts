// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from 'vitest';
import {
  bitsForMax,
  createBitFieldLayout,
  bitPack,
  bitUnpack,
  bitPackToBytes,
  bitUnpackFromBytes,
  bitPackToHex,
  bitUnpackFromHex,
  bigintToBytes,
  bytesToBigint,
  analyzeBitVsHex,
} from './bit-field-layout.js';
import { WeightedIndex } from '../math/weighted-index.js';
import { WeightedIndexBig } from '../math/weighted-index-big.js';

// ═════════════════════════════════════════════════════════════════════════════
//  1. bitsForMax — 최소 비트 수 계산
// ═════════════════════════════════════════════════════════════════════════════

describe('bitsForMax', () => {
  it('경계값: 0과 1', () => {
    expect(bitsForMax(0)).toBe(0);
    expect(bitsForMax(1)).toBe(1); // 0 또는 1 → 1비트
  });

  it('2의 거듭제곱 경계', () => {
    // 2^n - 1 은 정확히 n비트, 2^n은 n+1비트 필요
    expect(bitsForMax(3)).toBe(2); // 0..3 → 2 bits (정확히 맞음)
    expect(bitsForMax(4)).toBe(3); // 0..4 → 3 bits (넘침)
    expect(bitsForMax(7)).toBe(3);
    expect(bitsForMax(8)).toBe(4);
    expect(bitsForMax(15)).toBe(4); // 0..15 = 1 hex char
    expect(bitsForMax(16)).toBe(5); // 0..16 → hex char 경계 초과
    expect(bitsForMax(255)).toBe(8); // 0..255 = 2 hex chars
    expect(bitsForMax(256)).toBe(9);
  });

  it('실용적인 값', () => {
    expect(bitsForMax(99999)).toBe(17); // 권한 인덱스 범위
    expect(bitsForMax(65535)).toBe(16); // uint16
    expect(bitsForMax(65536)).toBe(17);
    expect(bitsForMax(1023)).toBe(10); // 10비트 슬롯
    expect(bitsForMax(100)).toBe(7); // 101개 → 7비트
  });

  it('음수 → 0', () => {
    expect(bitsForMax(-1)).toBe(0);
    expect(bitsForMax(-100)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  2. createBitFieldLayout — 레이아웃 정의
// ═════════════════════════════════════════════════════════════════════════════

describe('createBitFieldLayout', () => {
  it('기본: offset 누적 계산', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 15 }, // 4 bits, offset 0
      { name: 'b', maxValue: 7 }, // 3 bits, offset 4
      { name: 'c', maxValue: 3 }, // 2 bits, offset 7
    ]);
    expect(layout.totalBits).toBe(9);
    expect(layout.totalBytes).toBe(2); // ⌈9/8⌉ = 2
    expect(layout.fields).toHaveLength(3);
    expect(layout.fields[0]).toMatchObject({ name: 'a', bits: 4, offset: 0 });
    expect(layout.fields[1]).toMatchObject({ name: 'b', bits: 3, offset: 4 });
    expect(layout.fields[2]).toMatchObject({ name: 'c', bits: 2, offset: 7 });
  });

  it('field.maxValue는 2^bits - 1 (실제 수용 가능한 최대)', () => {
    const layout = createBitFieldLayout([
      { name: 'x', maxValue: 10 }, // bitsForMax(10)=4, 실제 max=15
    ]);
    expect(layout.fields[0].bits).toBe(4);
    expect(layout.fields[0].maxValue).toBe(15n);
  });

  it('명시적 bits 오버라이드', () => {
    const layout = createBitFieldLayout([
      { name: 'x', maxValue: 3, bits: 8 }, // 3은 2비트로 충분하지만 8비트 강제
    ]);
    expect(layout.fields[0].bits).toBe(8);
    expect(layout.fields[0].maxValue).toBe(255n);
    expect(layout.totalBits).toBe(8);
  });

  it('단일 필드', () => {
    const layout = createBitFieldLayout([{ name: 'only', maxValue: 1 }]);
    expect(layout.totalBits).toBe(1);
    expect(layout.totalBytes).toBe(1);
  });

  it('frozen (immutable)', () => {
    const layout = createBitFieldLayout([{ name: 'a', maxValue: 7 }]);
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.fields)).toBe(true);
    expect(Object.isFrozen(layout.fields[0])).toBe(true);
  });

  it('빈 specs → throw', () => {
    expect(() => createBitFieldLayout([])).toThrow('최소 하나의 필드');
  });

  it('maxValue 0 (비트 0) → throw', () => {
    expect(() => createBitFieldLayout([{ name: 'x', maxValue: 0 }])).toThrow('1비트 이상');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  3. bitPack / bitUnpack — Number 값 라운드트립
// ═════════════════════════════════════════════════════════════════════════════

describe('bitPack / bitUnpack — Number 라운드트립', () => {
  // 권한 시스템 실사용 시나리오: prefix(4b) + version(3b) + shard(2b) + index(17b)
  const layout = createBitFieldLayout([
    { name: 'prefix', maxValue: 15 },
    { name: 'version', maxValue: 7 },
    { name: 'shard', maxValue: 3 },
    { name: 'index', maxValue: 99999 },
  ]);

  it('일반 값', () => {
    const values = { prefix: 10, version: 5, shard: 2, index: 42 };
    const packed = bitPack(layout, values);
    const u = bitUnpack(layout, packed);
    expect(u.prefix).toBe(10n);
    expect(u.version).toBe(5n);
    expect(u.shard).toBe(2n);
    expect(u.index).toBe(42n);
  });

  it('모든 필드 최대값', () => {
    const u = bitUnpack(
      layout,
      bitPack(layout, {
        prefix: 15,
        version: 7,
        shard: 3,
        index: 99999,
      }),
    );
    expect(u.prefix).toBe(15n);
    expect(u.version).toBe(7n);
    expect(u.shard).toBe(3n);
    expect(u.index).toBe(99999n);
  });

  it('모든 필드 0', () => {
    const packed = bitPack(layout, { prefix: 0, version: 0, shard: 0, index: 0 });
    expect(packed).toBe(0n);
    const u = bitUnpack(layout, packed);
    expect(Object.values(u).every((v) => v === 0n)).toBe(true);
  });

  it('오버플로우 → 마스킹 (상위 비트 절삭)', () => {
    // prefix는 4비트(0..15), 255(0xFF) 입력 → 0xF = 15로 잘림
    const u = bitUnpack(layout, bitPack(layout, { prefix: 255, version: 0, shard: 0, index: 0 }));
    expect(u.prefix).toBe(15n);
  });

  it('누락 필드 → 0 처리', () => {
    const u = bitUnpack(layout, bitPack(layout, { prefix: 5 }));
    expect(u.prefix).toBe(5n);
    expect(u.version).toBe(0n);
    expect(u.shard).toBe(0n);
    expect(u.index).toBe(0n);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  4. bitPack / bitUnpack — BigInt 값 입출력
// ═════════════════════════════════════════════════════════════════════════════

describe('bitPack / bitUnpack — BigInt 입력', () => {
  const layout = createBitFieldLayout([
    { name: 'prefix', maxValue: 15 },
    { name: 'version', maxValue: 7 },
    { name: 'shard', maxValue: 3 },
    { name: 'index', maxValue: 99999 },
  ]);

  it('모든 필드를 bigint로 입력', () => {
    const u = bitUnpack(
      layout,
      bitPack(layout, {
        prefix: 10n,
        version: 3n,
        shard: 1n,
        index: 50000n,
      }),
    );
    expect(u.prefix).toBe(10n);
    expect(u.version).toBe(3n);
    expect(u.shard).toBe(1n);
    expect(u.index).toBe(50000n);
  });

  it('Number와 BigInt 혼합 입력', () => {
    const u = bitUnpack(
      layout,
      bitPack(layout, {
        prefix: 12, // Number
        version: 5n, // BigInt
        shard: 2, // Number
        index: 77777n, // BigInt
      }),
    );
    expect(u.prefix).toBe(12n);
    expect(u.version).toBe(5n);
    expect(u.shard).toBe(2n);
    expect(u.index).toBe(77777n);
  });

  it('BigInt 오버플로우도 마스킹', () => {
    // shard는 2비트(max 3), 100n 입력 → 100 & 3 = 0
    const u = bitUnpack(
      layout,
      bitPack(layout, {
        prefix: 0n,
        version: 0n,
        shard: 100n,
        index: 0n,
      }),
    );
    expect(u.shard).toBe(100n & 3n);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  5. BigInt 전용 대규모 필드 (Number.MAX_SAFE_INTEGER 초과)
// ═════════════════════════════════════════════════════════════════════════════

describe('BigInt 대규모 필드 — Number.MAX_SAFE_INTEGER 초과', () => {
  it('64-bit 필드 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'hi', maxValue: 0, bits: 64 },
      { name: 'lo', maxValue: 0, bits: 64 },
    ]);
    const hi = 0xdeadbeefcafebaben;
    const lo = 0x0123456789abcdefn;
    const u = bitUnpack(layout, bitPack(layout, { hi, lo }));
    expect(u.hi).toBe(hi);
    expect(u.lo).toBe(lo);
  });

  it('119-bit index 필드 (UUID bit-pack 실사용)', () => {
    // bit-pack UUID: prefix(4b) + version(3b) + shard(2b) + index(119b) = 128 bits
    const layout = createBitFieldLayout([
      { name: 'prefix', maxValue: 15 },
      { name: 'version', maxValue: 7 },
      { name: 'shard', maxValue: 3 },
      { name: 'index', maxValue: 0, bits: 119 },
    ]);
    expect(layout.totalBits).toBe(128);

    // 119-bit 최대값: 2^119 - 1
    const maxIndex = (1n << 119n) - 1n;
    const u = bitUnpack(
      layout,
      bitPack(layout, {
        prefix: 15,
        version: 7,
        shard: 3,
        index: maxIndex,
      }),
    );
    expect(u.prefix).toBe(15n);
    expect(u.version).toBe(7n);
    expect(u.shard).toBe(3n);
    expect(u.index).toBe(maxIndex);
  });

  it('256-bit 레이아웃 (SHA-256 급)', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 0, bits: 128 },
      { name: 'b', maxValue: 0, bits: 128 },
    ]);
    expect(layout.totalBits).toBe(256);
    expect(layout.totalBytes).toBe(32);

    const a = (1n << 127n) + 42n;
    const b = (1n << 100n) - 1n;
    const u = bitUnpack(layout, bitPack(layout, { a, b }));
    expect(u.a).toBe(a);
    expect(u.b).toBe(b);
  });

  it('단일 200-bit 필드', () => {
    const layout = createBitFieldLayout([{ name: 'x', maxValue: 0, bits: 200 }]);
    const val = (1n << 199n) | (1n << 100n) | 0xffn;
    const u = bitUnpack(layout, bitPack(layout, { x: val }));
    expect(u.x).toBe(val);
  });

  it('MAX_SAFE_INTEGER 근처 값 정밀도', () => {
    const layout = createBitFieldLayout([{ name: 'x', maxValue: 0, bits: 53 }]);
    // Number.MAX_SAFE_INTEGER = 2^53 - 1 = 9007199254740991
    const safeMax = BigInt(Number.MAX_SAFE_INTEGER);
    const u = bitUnpack(layout, bitPack(layout, { x: safeMax }));
    expect(u.x).toBe(safeMax);
  });

  it('MAX_SAFE_INTEGER + 1 (Number 한계 초과)', () => {
    const layout = createBitFieldLayout([{ name: 'x', maxValue: 0, bits: 54 }]);
    const val = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    const u = bitUnpack(layout, bitPack(layout, { x: val }));
    expect(u.x).toBe(val); // BigInt이므로 정밀도 손실 없음
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  6. 비트 독립성 검증 — 필드 간 간섭 없음
// ═════════════════════════════════════════════════════════════════════════════

describe('비트 독립성', () => {
  const layout = createBitFieldLayout([
    { name: 'a', maxValue: 7 }, // 3 bits
    { name: 'b', maxValue: 15 }, // 4 bits
    { name: 'c', maxValue: 3 }, // 2 bits
  ]);

  it('a 변경이 b, c에 영향 없음', () => {
    for (let a = 0; a <= 7; a++) {
      const u = bitUnpack(layout, bitPack(layout, { a, b: 9, c: 2 }));
      expect(u.b).toBe(9n);
      expect(u.c).toBe(2n);
      expect(u.a).toBe(BigInt(a));
    }
  });

  it('전수 검사: 모든 조합이 고유한 packed 값 (8×16×4 = 512)', () => {
    const seen = new Set<bigint>();
    for (let a = 0; a <= 7; a++) {
      for (let b = 0; b <= 15; b++) {
        for (let c = 0; c <= 3; c++) {
          const packed = bitPack(layout, { a, b, c });
          expect(seen.has(packed)).toBe(false);
          seen.add(packed);
          const u = bitUnpack(layout, packed);
          expect(u.a).toBe(BigInt(a));
          expect(u.b).toBe(BigInt(b));
          expect(u.c).toBe(BigInt(c));
        }
      }
    }
    expect(seen.size).toBe(8 * 16 * 4);
  });

  it('BigInt 입력에서도 독립성 유지', () => {
    const bigLayout = createBitFieldLayout([
      { name: 'tag', maxValue: 3 }, // 2 bits
      { name: 'payload', maxValue: 0, bits: 64 }, // 64 bits
    ]);
    const payload = 0xabcdef0123456789n;
    for (let tag = 0n; tag <= 3n; tag++) {
      const u = bitUnpack(bigLayout, bitPack(bigLayout, { tag, payload }));
      expect(u.payload).toBe(payload);
      expect(u.tag).toBe(tag);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  7. Byte array conversion
// ═════════════════════════════════════════════════════════════════════════════

describe('byte array conversion', () => {
  it('bigintToBytes / bytesToBigint 기본 라운드트립', () => {
    const val = 0x1234567890abcdefn;
    const bytes = bigintToBytes(val, 8);
    expect(bytes).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef]));
    expect(bytesToBigint(bytes)).toBe(val);
  });

  it('0 값', () => {
    expect(bigintToBytes(0n, 4)).toEqual(new Uint8Array([0, 0, 0, 0]));
    expect(bytesToBigint(new Uint8Array([0, 0, 0, 0]))).toBe(0n);
  });

  it('음수 → 0으로 처리', () => {
    expect(bigintToBytes(-1n, 2)).toEqual(new Uint8Array([0, 0]));
  });

  it('128-bit (16 bytes)', () => {
    const val = (1n << 127n) | 1n;
    const bytes = bigintToBytes(val, 16);
    expect(bytes[0]).toBe(0x80); // MSB set
    expect(bytes[15]).toBe(0x01); // LSB set
    expect(bytesToBigint(bytes)).toBe(val);
  });

  it('bitPackToBytes / bitUnpackFromBytes 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 15 },
      { name: 'b', maxValue: 255 },
    ]);
    const bytes = bitPackToBytes(layout, { a: 12, b: 200 });
    expect(bytes.length).toBe(layout.totalBytes);
    const u = bitUnpackFromBytes(layout, bytes);
    expect(u.a).toBe(12n);
    expect(u.b).toBe(200n);
  });

  it('BigInt 필드의 bytes 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'tag', maxValue: 0, bits: 8 },
      { name: 'data', maxValue: 0, bits: 120 },
    ]);
    const data = (1n << 119n) - 7n;
    const bytes = bitPackToBytes(layout, { tag: 0xabn, data });
    expect(bytes.length).toBe(16);
    const u = bitUnpackFromBytes(layout, bytes);
    expect(u.tag).toBe(0xabn);
    expect(u.data).toBe(data);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  8. Hex conversion
// ═════════════════════════════════════════════════════════════════════════════

describe('hex conversion', () => {
  it('nibble 정렬 레이아웃 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 255 },
      { name: 'b', maxValue: 255 },
    ]);
    const hex = bitPackToHex(layout, { a: 0xab, b: 0xcd });
    expect(hex).toBe('abcd');
    const u = bitUnpackFromHex(layout, hex);
    expect(u.a).toBe(0xabn);
    expect(u.b).toBe(0xcdn);
  });

  it('nibble 비정렬 레이아웃', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 7 }, // 3 bits
      { name: 'b', maxValue: 7 }, // 3 bits
    ]);
    // a=5(101) b=3(011) → 101011 = 0x2b
    expect(bitPackToHex(layout, { a: 5, b: 3 })).toBe('2b');
    const u = bitUnpackFromHex(layout, '2b');
    expect(u.a).toBe(5n);
    expect(u.b).toBe(3n);
  });

  it('dash/공백 포함 hex 입력', () => {
    const layout = createBitFieldLayout([
      { name: 'x', maxValue: 255 },
      { name: 'y', maxValue: 255 },
    ]);
    expect(bitUnpackFromHex(layout, 'ab-cd').x).toBe(0xabn);
    expect(bitUnpackFromHex(layout, 'ab cd').y).toBe(0xcdn);
  });

  it('128-bit hex 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 0, bits: 64 },
      { name: 'b', maxValue: 0, bits: 64 },
    ]);
    const hex = bitPackToHex(layout, {
      a: 0xffffffffffffffffn,
      b: 0x0000000000000001n,
    });
    expect(hex).toBe('ffffffffffffffff0000000000000001');
    const u = bitUnpackFromHex(layout, hex);
    expect(u.a).toBe(0xffffffffffffffffn);
    expect(u.b).toBe(1n);
  });

  it('빈 hex → 0', () => {
    const layout = createBitFieldLayout([{ name: 'x', maxValue: 255 }]);
    const u = bitUnpackFromHex(layout, '');
    expect(u.x).toBe(0n);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  9. analyzeBitVsHex — 절약량 분석
// ═════════════════════════════════════════════════════════════════════════════

describe('analyzeBitVsHex', () => {
  it('혼합 필드 절약량', () => {
    const a = analyzeBitVsHex([
      { name: 'prefix', maxValue: 15 }, // 4 vs 4 → 0
      { name: 'version', maxValue: 7 }, // 3 vs 4 → 1
      { name: 'shard', maxValue: 3 }, // 2 vs 4 → 2
      { name: 'index', maxValue: 99999 }, // 17 vs 20 → 3
    ]);
    expect(a.totalBitWidth).toBe(26);
    expect(a.totalHexWidth).toBe(32);
    expect(a.savedBits).toBe(6);
    expect(a.capacityMultiplier).toBe(64);
    expect(a.efficiencyGain).toBeCloseTo(6 / 32);
  });

  it('hex 정렬 → 절약 없음', () => {
    const a = analyzeBitVsHex([
      { name: 'a', maxValue: 15 },
      { name: 'b', maxValue: 255 },
    ]);
    expect(a.savedBits).toBe(0);
    expect(a.capacityMultiplier).toBe(1);
  });

  it('per-field 상세', () => {
    const a = analyzeBitVsHex([{ name: 'version', maxValue: 5 }]);
    expect(a.fields[0]).toEqual({
      name: 'version',
      maxValue: 5,
      bitWidth: 3,
      hexWidth: 4,
      savedBits: 1,
    });
  });

  it('bits 오버라이드 시 hex 폭도 bits 기준으로 계산', () => {
    // maxValue: 0이지만 bits: 119 → hex 폭 = ceil(119/4)*4 = 120
    const a = analyzeBitVsHex([{ name: 'index', maxValue: 0, bits: 119 }]);
    expect(a.fields[0].bitWidth).toBe(119);
    expect(a.fields[0].hexWidth).toBe(120); // ceil(119/4) = 30 hex chars × 4
    expect(a.savedBits).toBe(1);
  });

  it('여러 필드 bits 오버라이드 혼합', () => {
    const a = analyzeBitVsHex([
      { name: 'prefix', maxValue: 15 }, // 4 vs 4
      { name: 'version', maxValue: 7 }, // 3 vs 4
      { name: 'index', maxValue: 0, bits: 53 }, // 53 vs 56 (ceil(53/4)=14 hex)
    ]);
    expect(a.totalBitWidth).toBe(4 + 3 + 53); // 60
    expect(a.totalHexWidth).toBe(4 + 4 + 56); // 64
    expect(a.savedBits).toBe(4);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  10. WeightedIndex (Number) + bitPack 통합
// ═════════════════════════════════════════════════════════════════════════════

describe('WeightedIndex + bitPack 통합', () => {
  // 실제 시나리오: role(10) × action(8) × resource(20) = 1600
  const wi = new WeightedIndex([10, 8, 20], ['role', 'action', 'resource']);

  const layout = createBitFieldLayout([
    { name: 'prefix', maxValue: 15 }, // 4 bits
    { name: 'version', maxValue: 3 }, // 2 bits
    { name: 'index', maxValue: wi.size - 1 }, // bitsForMax(1599) = 11 bits
  ]);

  it('encode → bitPack → bitUnpack → decode 전체 파이프라인', () => {
    const coords = [3, 5, 12]; // role=3, action=5, resource=12
    const index = wi.encode(coords);

    const packed = bitPack(layout, { prefix: 10, version: 2, index });
    const u = bitUnpack(layout, packed);

    expect(Number(u.prefix)).toBe(10);
    expect(Number(u.version)).toBe(2);
    expect(Number(u.index)).toBe(index);

    // 복원
    const decoded = wi.decode(Number(u.index));
    expect(decoded).toEqual(coords);
  });

  it('모든 좌표에 대해 라운드트립 정확성', () => {
    // 전체 공간 중 랜덤 100개 샘플링
    const samples: number[][] = [];
    for (let i = 0; i < 100; i++) {
      samples.push([
        Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 8) + 1,
        Math.floor(Math.random() * 20) + 1,
      ]);
    }

    for (const coords of samples) {
      const index = wi.encode(coords);
      const packed = bitPack(layout, { prefix: 7, version: 1, index });
      const u = bitUnpack(layout, packed);
      const restored = wi.decode(Number(u.index));
      expect(restored).toEqual(coords);
    }
  });

  it('절약량: hex 대비', () => {
    const a = analyzeBitVsHex([
      { name: 'prefix', maxValue: 15 },
      { name: 'version', maxValue: 3 },
      { name: 'index', maxValue: wi.size - 1 },
    ]);
    // prefix: 4/4, version: 2/4, index: 11/12
    expect(a.savedBits).toBe(3);
    expect(a.capacityMultiplier).toBe(8);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  11. WeightedIndexBig + bitPack 통합 (BigInt 전용)
// ═════════════════════════════════════════════════════════════════════════════

describe('WeightedIndexBig + bitPack 통합', () => {
  // 큰 shape: 2^53을 초과하는 product
  // 100000 × 10000 × 10000 × 1000 = 10^18 > 2^53
  const shape = [100000n, 10000n, 10000n, 1000n];
  const wiBig = new WeightedIndexBig(shape, ['ns', 'name', 'resource', 'action']);

  it('size가 Number.MAX_SAFE_INTEGER 초과', () => {
    expect(wiBig.size).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });

  it('encode → bitPack → bitUnpack → decode 파이프라인', () => {
    const layout = createBitFieldLayout([
      { name: 'prefix', maxValue: 7 }, // 3 bits
      { name: 'version', maxValue: 3 }, // 2 bits
      { name: 'index', maxValue: 0, bits: 60 }, // 60 bits (2^60 > 10^18)
    ]);

    const coords = [50000n, 5000n, 7777n, 500n];
    const index = wiBig.encode(coords);

    const packed = bitPack(layout, { prefix: 5, version: 2, index });
    const u = bitUnpack(layout, packed);

    expect(u.prefix).toBe(5n);
    expect(u.version).toBe(2n);
    expect(u.index).toBe(index);

    // 복원
    const decoded = wiBig.decode(u.index);
    expect(decoded).toEqual(coords);
  });

  it('최대 좌표 라운드트립', () => {
    const layout = createBitFieldLayout([{ name: 'index', maxValue: 0, bits: 64 }]);

    const maxCoords = shape.map((s) => s); // [100000, 10000, 10000, 1000]
    const maxIndex = wiBig.encode(maxCoords);

    const u = bitUnpack(layout, bitPack(layout, { index: maxIndex }));
    const decoded = wiBig.decode(u.index);
    expect(decoded).toEqual(maxCoords);
  });

  it('최소 좌표 라운드트립', () => {
    const layout = createBitFieldLayout([{ name: 'index', maxValue: 0, bits: 64 }]);

    const minCoords = [1n, 1n, 1n, 1n];
    const minIndex = wiBig.encode(minCoords); // 0

    const u = bitUnpack(layout, bitPack(layout, { index: minIndex }));
    expect(u.index).toBe(0n);
    expect(wiBig.decode(u.index)).toEqual(minCoords);
  });

  it('BigInt 인덱스의 bytes 직렬화 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'prefix', maxValue: 15 },
      { name: 'index', maxValue: 0, bits: 60 },
    ]);

    const coords = [99999n, 9999n, 9999n, 999n];
    const index = wiBig.encode(coords);

    const bytes = bitPackToBytes(layout, { prefix: 0xa, index });
    const u = bitUnpackFromBytes(layout, bytes);
    expect(wiBig.decode(u.index)).toEqual(coords);
  });

  it('BigInt 인덱스의 hex 직렬화 라운드트립', () => {
    const layout = createBitFieldLayout([
      { name: 'prefix', maxValue: 15 },
      { name: 'index', maxValue: 0, bits: 60 },
    ]);

    const coords = [12345n, 6789n, 4321n, 100n];
    const index = wiBig.encode(coords);

    const hex = bitPackToHex(layout, { prefix: 0xf, index });
    const u = bitUnpackFromHex(layout, hex);
    expect(u.prefix).toBe(0xfn);
    expect(wiBig.decode(u.index)).toEqual(coords);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  12. 실사용 시나리오: hex 패킹 대비 밀도 비교
// ═════════════════════════════════════════════════════════════════════════════

describe('실사용 시나리오 — hex vs bit 밀도 비교', () => {
  it('UUID 128-bit 컨테이너: 메타 3필드 + 인덱스', () => {
    // hex 기준: prefix(2 chars=8b) + version(1 char=4b) + shard(1 char=4b) = 16b overhead
    //           index = 128 - 16 = 112 bits
    // bit 기준: prefix(max 200→8b) + version(max 7→3b) + shard(max 5→3b) = 14b overhead
    //           index = 128 - 14 = 114 bits → 4× 더 많은 주소
    const analysis = analyzeBitVsHex([
      { name: 'prefix', maxValue: 200 }, // 8b vs 8b → 0
      { name: 'version', maxValue: 7 }, // 3b vs 4b → 1
      { name: 'shard', maxValue: 5 }, // 3b vs 4b → 1
    ]);
    expect(analysis.savedBits).toBe(2);
    expect(analysis.capacityMultiplier).toBe(4);
  });

  it('int64 16-char 컨테이너: 메타 2필드 + 인덱스', () => {
    // hex: prefix(1 char=4b) + version(1 char=4b) → index = 56b
    // bit: prefix(max 10→4b) + version(max 5→3b) → index = 57b → 2× 더 많은 주소
    const analysis = analyzeBitVsHex([
      { name: 'prefix', maxValue: 10 },
      { name: 'version', maxValue: 5 },
    ]);
    expect(analysis.savedBits).toBe(1);
    expect(analysis.capacityMultiplier).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  13. 엣지 케이스
// ═════════════════════════════════════════════════════════════════════════════

describe('엣지 케이스', () => {
  it('1-bit 필드', () => {
    const layout = createBitFieldLayout([{ name: 'flag', maxValue: 1 }]);
    expect(layout.totalBits).toBe(1);

    expect(bitUnpack(layout, bitPack(layout, { flag: 0 })).flag).toBe(0n);
    expect(bitUnpack(layout, bitPack(layout, { flag: 1 })).flag).toBe(1n);
    // 오버플로우: 2 & 1 = 0
    expect(bitUnpack(layout, bitPack(layout, { flag: 2 })).flag).toBe(0n);
  });

  it('많은 작은 필드 (8개 × 1-bit = 1 byte)', () => {
    const specs = Array.from({ length: 8 }, (_, i) => ({
      name: `f${i}`,
      maxValue: 1,
    }));
    const layout = createBitFieldLayout(specs);
    expect(layout.totalBits).toBe(8);
    expect(layout.totalBytes).toBe(1);

    // 0b10101010 = 0xAA
    const values: Record<string, number> = {};
    for (let i = 0; i < 8; i++) values[`f${i}`] = i % 2 === 0 ? 1 : 0;
    const packed = bitPack(layout, values);
    expect(packed).toBe(0xaan);
  });

  it('연속된 동일 값의 독립 추출', () => {
    const layout = createBitFieldLayout([
      { name: 'a', maxValue: 255 },
      { name: 'b', maxValue: 255 },
      { name: 'c', maxValue: 255 },
    ]);
    // 모두 같은 값이지만 독립적으로 추출
    const u = bitUnpack(layout, bitPack(layout, { a: 0x12, b: 0x12, c: 0x12 }));
    expect(u.a).toBe(0x12n);
    expect(u.b).toBe(0x12n);
    expect(u.c).toBe(0x12n);
  });

  it('bytes 변환: nibble 비정렬 시 패딩 비트 = 0', () => {
    // 5-bit 레이아웃 → 1 byte, 상위 3 bits는 0으로 패딩
    const layout = createBitFieldLayout([{ name: 'x', maxValue: 31 }]);
    const bytes = bitPackToBytes(layout, { x: 31 });
    // 31 = 0b11111, 1 byte에서 상위 3 bits = 0 → 0b00011111 = 0x1F
    expect(bytes).toEqual(new Uint8Array([0x1f]));
  });
});
