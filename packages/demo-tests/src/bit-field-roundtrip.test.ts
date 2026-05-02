// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * bit-field-roundtrip.test.ts — bit-field-layout 데이터 변환 라운드트립 검증
 *
 * bit-level 패킹의 모든 변환 분기에서 데이터가 손실 없이 왕복하는지 검증한다.
 * 단위 테스트(weighted-index/src/bit-field-layout.test.ts)와 달리,
 * 실사용 시나리오 기반의 E2E 파이프라인을 검증한다.
 *
 * ── 변환 경로 맵 ──────────────────────────────────────────────────────────
 *
 *   좌표 (coords)
 *     │
 *     ├─ [Number] WeightedIndex.encode()
 *     │     │
 *     │     ▼
 *     │   1D index (number)
 *     │     │
 *     │     ├─ bitPack()  ──→ bigint ──→ bitUnpack()  ──→ 1D index
 *     │     ├─ bitPackToHex()  ──→ hex string ──→ bitUnpackFromHex()
 *     │     └─ bitPackToBytes() ──→ Uint8Array ──→ bitUnpackFromBytes()
 *     │
 *     ├─ [BigInt] WeightedIndexBig.encode()
 *     │     │
 *     │     ▼
 *     │   1D index (bigint)
 *     │     │
 *     │     ├─ bitPack()  ──→ bigint
 *     │     ├─ bitPackToHex()  ──→ hex string
 *     │     └─ bitPackToBytes() ──→ Uint8Array
 *     │
 *     └─ [교차] Number encode → bitPack → hex → bitUnpack → BigInt decode
 *                              ↕ 동등성 검증 ↕
 *              BigInt encode → bitPack → hex → bitUnpack → Number decode
 *
 * ── 섹션 ──────────────────────────────────────────────────────────────────
 *
 * [BF-1] Number 경로: coords → encode → bitPack → 3-format roundtrip → decode
 * [BF-2] BigInt 경로: coords → encodeBig → bitPack → 3-format roundtrip → decode
 * [BF-3] Number ↔ BigInt 교차 동등성
 * [BF-4] hex-pack(uuid-layout) vs bit-pack 동등성
 * [BF-5] 실사용: 권한 시스템 E2E (encode → pack → 저장 → 복원 → decode)
 * [BF-6] 밀도 분석 정합성: analyzeBitVsHex 결과가 실제 pack 결과와 일치
 */

import { describe, it, expect } from "vitest";
import {
  WeightedIndex,
  WeightedIndexBig,
  createBitFieldLayout,
  bitPack,
  bitUnpack,
  bitPackToHex,
  bitUnpackFromHex,
  bitPackToBytes,
  bitUnpackFromBytes,
  bigintToBytes,
  bytesToBigint,
  bitsForMax,
  analyzeBitVsHex,
  createUUIDLayout,
  packUUID,
  unpackUUID,
  type BitFieldLayout,
} from "weighted-index";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

/** SaaS 권한 모델: role(5) × action(8) × resource(20) = 800 */
const PERM_SHAPE = [5, 8, 20];
const PERM_LABELS = ["role", "action", "resource"];

/** 메타 필드 정의: prefix(max 15) + version(max 7) + shard(max 3) */
const META_SPECS = [
  { name: "prefix",  maxValue: 15 },   // 4 bits
  { name: "version", maxValue: 7 },    // 3 bits
  { name: "shard",   maxValue: 3 },    // 2 bits
] as const;

function createPermLayout(wi: WeightedIndex | { size: number | bigint }): BitFieldLayout {
  const size = typeof wi.size === "bigint" ? Number(wi.size) : wi.size;
  return createBitFieldLayout([
    ...META_SPECS,
    { name: "index", maxValue: size - 1 },
  ]);
}

function createPermLayoutBig(): BitFieldLayout {
  // BigInt 용 큰 shape: 10^7 × 10^6 × 10^4 = 10^17 > 2^53
  return createBitFieldLayout([
    ...META_SPECS,
    { name: "index", maxValue: 0, bits: 64 },
  ]);
}

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-1] Number 경로: 3-format 라운드트립
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-1] Number 경로 — coords → encode → bitPack → 3-format roundtrip → decode", () => {
  const wi = new WeightedIndex(PERM_SHAPE, PERM_LABELS);
  const layout = createPermLayout(wi);

  // 대표 좌표: 경계값 + 중간값
  const testCoords: number[][] = [
    [1, 1, 1],                // 최소
    [5, 8, 20],               // 최대
    [3, 4, 10],               // 중간
    [1, 8, 20],               // 첫 차원 최소 + 나머지 최대
    [5, 1, 1],                // 첫 차원 최대 + 나머지 최소
  ];

  const metaValues = { prefix: 10, version: 5, shard: 2 };

  for (const coords of testCoords) {
    const label = `coords [${coords}]`;

    it(`${label} — bigint 라운드트립`, () => {
      const index = wi.encode(coords);
      const packed = bitPack(layout, { ...metaValues, index });
      const u = bitUnpack(layout, packed);

      expect(Number(u.prefix)).toBe(metaValues.prefix);
      expect(Number(u.version)).toBe(metaValues.version);
      expect(Number(u.shard)).toBe(metaValues.shard);
      expect(wi.decode(Number(u.index))).toEqual(coords);
    });

    it(`${label} — hex 라운드트립`, () => {
      const index = wi.encode(coords);
      const hex = bitPackToHex(layout, { ...metaValues, index });
      const u = bitUnpackFromHex(layout, hex);

      expect(Number(u.prefix)).toBe(metaValues.prefix);
      expect(wi.decode(Number(u.index))).toEqual(coords);
    });

    it(`${label} — bytes 라운드트립`, () => {
      const index = wi.encode(coords);
      const bytes = bitPackToBytes(layout, { ...metaValues, index });
      const u = bitUnpackFromBytes(layout, bytes);

      expect(Number(u.prefix)).toBe(metaValues.prefix);
      expect(wi.decode(Number(u.index))).toEqual(coords);
    });
  }

  it("3-format 교차: bigint → hex → bytes → bigint 동일 값", () => {
    const coords = [3, 5, 12];
    const index = wi.encode(coords);
    const values = { ...metaValues, index };

    // 경로 1: bitPack → bigint
    const packed = bitPack(layout, values);

    // 경로 2: bitPackToHex → bitUnpackFromHex → bigint
    const hex = bitPackToHex(layout, values);
    const fromHex = bitPack(layout, bitUnpackFromHex(layout, hex));

    // 경로 3: bitPackToBytes → bitUnpackFromBytes → bigint
    const bytes = bitPackToBytes(layout, values);
    const fromBytes = bitPack(layout, bitUnpackFromBytes(layout, bytes));

    expect(fromHex).toBe(packed);
    expect(fromBytes).toBe(packed);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-2] BigInt 경로: MAX_SAFE_INTEGER 초과 인덱스
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-2] BigInt 경로 — encodeBig → bitPack → 3-format roundtrip → decodeBig", () => {
  // shape product > 2^53: 10^7 × 10^6 × 10^4 = 10^17 > 9 × 10^15
  const shape = [10_000_000n, 1_000_000n, 10_000n];
  const wiBig = new WeightedIndexBig(shape, ["role", "action", "resource"]);
  const layout = createPermLayoutBig();

  it("size > MAX_SAFE_INTEGER", () => {
    expect(wiBig.size).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });

  const testCoords: bigint[][] = [
    [1n, 1n, 1n],
    [10_000_000n, 1_000_000n, 10_000n],
    [5_000_000n, 500_000n, 5_000n],
    [1n, 1_000_000n, 10_000n],
    [9_999_999n, 1n, 1n],
  ];

  const metaValues = { prefix: 15, version: 7, shard: 3 };

  for (const coords of testCoords) {
    const label = `coords [${coords.map(String)}]`;

    it(`${label} — bigint 라운드트립`, () => {
      const index = wiBig.encode(coords);
      const packed = bitPack(layout, { ...metaValues, index });
      const u = bitUnpack(layout, packed);

      expect(Number(u.prefix)).toBe(15);
      expect(Number(u.version)).toBe(7);
      expect(Number(u.shard)).toBe(3);
      expect(wiBig.decode(u.index)).toEqual(coords);
    });

    it(`${label} — hex 라운드트립`, () => {
      const index = wiBig.encode(coords);
      const hex = bitPackToHex(layout, { ...metaValues, index });
      const u = bitUnpackFromHex(layout, hex);
      expect(wiBig.decode(u.index)).toEqual(coords);
    });

    it(`${label} — bytes 라운드트립`, () => {
      const index = wiBig.encode(coords);
      const bytes = bitPackToBytes(layout, { ...metaValues, index });
      const u = bitUnpackFromBytes(layout, bytes);
      expect(wiBig.decode(u.index)).toEqual(coords);
    });
  }

  it("3-format 교차: bigint → hex → bytes → bigint 동일 값", () => {
    const index = wiBig.encode([7777n, 3333n, 1111n]);
    const values = { ...metaValues, index };

    const packed = bitPack(layout, values);
    const fromHex = bitPack(layout, bitUnpackFromHex(layout, bitPackToHex(layout, values)));
    const fromBytes = bitPack(layout, bitUnpackFromBytes(layout, bitPackToBytes(layout, values)));

    expect(fromHex).toBe(packed);
    expect(fromBytes).toBe(packed);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-3] Number ↔ BigInt 교차 동등성
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-3] Number ↔ BigInt 교차 — 동일 좌표에서 bitPack 결과 동등", () => {
  const shape = [5, 8, 20];
  const shapeBig = shape.map(BigInt);
  const wi = new WeightedIndex(shape);
  const wiBig = new WeightedIndexBig(shapeBig);

  // 두 경로 모두 같은 bit-field layout 사용
  const layout = createBitFieldLayout([
    { name: "prefix",  maxValue: 15 },
    { name: "version", maxValue: 7 },
    { name: "index",   maxValue: wi.size - 1 },
  ]);

  it("모든 주소에 대해 Number encode → bitPack === BigInt encode → bitPack", () => {
    const prefix = 12;
    const version = 5;

    for (let v = 0; v < wi.size; v++) {
      const numCoords = wi.decode(v);
      const bigCoords = numCoords.map(BigInt);

      const numIndex = wi.encode(numCoords);
      const bigIndex = wiBig.encode(bigCoords);
      expect(bigIndex).toBe(BigInt(numIndex));

      const numPacked = bitPack(layout, { prefix, version, index: numIndex });
      const bigPacked = bitPack(layout, { prefix, version, index: bigIndex });
      expect(numPacked).toBe(bigPacked);
    }
  });

  it("교차 decode: Number pack → BigInt unpack → BigInt decode → Number coords", () => {
    const coords = [3, 5, 12];
    const index = wi.encode(coords);

    const packed = bitPack(layout, { prefix: 7, version: 3, index });
    const u = bitUnpack(layout, packed);

    // BigInt 경로로 decode
    const bigCoords = wiBig.decode(u.index);
    expect(bigCoords.map(Number)).toEqual(coords);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-4] hex-pack (uuid-layout) vs bit-pack 동등성
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-4] uuid-layout (hex) vs bit-field-layout — 동일 필드 값 보존", () => {
  // uuid-layout: hex-char 경계 (각 필드 = N hex chars)
  const uuidLayout = createUUIDLayout({
    left:  [{ name: "prefix", chars: 1 }, { name: "version", chars: 1 }],
    right: [{ name: "index", chars: 6 }],
  });

  // bit-field-layout: bit 경계 (prefix=4b, version=4b, index=24b)
  // uuid-layout의 hex chars를 bits로 변환하여 동일 필드 폭 보장
  const bitLayout = createBitFieldLayout([
    { name: "prefix",  maxValue: 15 },    // 4 bits = 1 hex char
    { name: "version", maxValue: 15 },    // 4 bits = 1 hex char
    { name: "index",   maxValue: 0, bits: 24 },  // 24 bits = 6 hex chars
  ]);

  const testCases = [
    { prefix: 0, version: 0, index: 0 },
    { prefix: 15, version: 15, index: 16777215 },  // 모든 필드 max
    { prefix: 10, version: 5, index: 42 },
    { prefix: 1, version: 1, index: 1000000 },
  ];

  for (const values of testCases) {
    it(`prefix=${values.prefix}, version=${values.version}, index=${values.index}`, () => {
      // uuid-layout 경로
      const uuidPacked = packUUID(uuidLayout, values);
      const uuidUnpacked = unpackUUID(uuidLayout, uuidPacked);

      // bit-field-layout 경로
      const bitPacked = bitPack(bitLayout, values);
      const bitUnpacked = bitUnpack(bitLayout, bitPacked);

      // 필드 값 동등성
      expect(Number(bitUnpacked.prefix)).toBe(uuidUnpacked.prefix);
      expect(Number(bitUnpacked.version)).toBe(uuidUnpacked.version);
      expect(Number(bitUnpacked.index)).toBe(uuidUnpacked.index);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-5] 실사용: 권한 시스템 E2E (저장 → 복원 파이프라인)
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-5] 권한 시스템 E2E — encode → bitPack → 저장(bytes) → 복원 → decode", () => {
  // 실제 권한 차원: namespace(3) × service(10) × type(4) × resource(50) × action(8)
  const shape = [3, 10, 4, 50, 8];
  const labels = ["namespace", "service", "type", "resource", "action"];
  const wi = new WeightedIndex(shape, labels);

  const layout = createBitFieldLayout([
    { name: "schemaId",  maxValue: 255 },   // 8 bits
    { name: "versionId", maxValue: 15 },    // 4 bits
    { name: "index",     maxValue: wi.size - 1 },
  ]);

  // 시뮬레이션: "서비스 A의 admin이 /users 리소스에 GET 요청"
  const scenario = {
    schemaId: 42,
    versionId: 3,
    coords: { namespace: 1, service: 5, type: 2, resource: 30, action: 4 },
  };

  it("단계별 파이프라인 검증", () => {
    // 1. 좌표 → 1D 인덱스
    const coordArr = labels.map(l => scenario.coords[l as keyof typeof scenario.coords]);
    const index = wi.encode(coordArr);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(wi.size);

    // 2. 메타 + 인덱스 → bit-packed bigint
    const packed = bitPack(layout, {
      schemaId: scenario.schemaId,
      versionId: scenario.versionId,
      index,
    });
    expect(typeof packed).toBe("bigint");

    // 3. bigint → bytes (DB/네트워크 저장)
    const stored = bigintToBytes(packed, layout.totalBytes);
    expect(stored).toBeInstanceOf(Uint8Array);

    // 4. bytes → bigint (복원)
    const restored = bytesToBigint(stored);
    expect(restored).toBe(packed);

    // 5. bigint → 필드 언팩
    const fields = bitUnpack(layout, restored);
    expect(Number(fields.schemaId)).toBe(scenario.schemaId);
    expect(Number(fields.versionId)).toBe(scenario.versionId);

    // 6. 인덱스 → 좌표 복원
    const decoded = wi.decode(Number(fields.index));
    expect(decoded).toEqual(coordArr);

    // 7. 좌표 → record
    const record = wi.decodeToRecord(Number(fields.index));
    expect(record).toEqual(scenario.coords);
  });

  it("100개 랜덤 좌표 파이프라인 라운드트립", () => {
    for (let i = 0; i < 100; i++) {
      const coords = shape.map(s => Math.floor(Math.random() * s) + 1);
      const index = wi.encode(coords);

      const bytes = bitPackToBytes(layout, { schemaId: 42, versionId: 3, index });
      const u = bitUnpackFromBytes(layout, bytes);
      const decoded = wi.decode(Number(u.index));

      expect(decoded).toEqual(coords);
    }
  });

  it("hex 경로 라운드트립", () => {
    const coordArr = labels.map(l => scenario.coords[l as keyof typeof scenario.coords]);
    const index = wi.encode(coordArr);

    const hex = bitPackToHex(layout, {
      schemaId: scenario.schemaId,
      versionId: scenario.versionId,
      index,
    });
    const u = bitUnpackFromHex(layout, hex);

    expect(Number(u.schemaId)).toBe(scenario.schemaId);
    expect(Number(u.versionId)).toBe(scenario.versionId);
    expect(wi.decode(Number(u.index))).toEqual(coordArr);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BF-6] analyzeBitVsHex 정합성 — 분석 결과가 실제 팩 결과와 일치
// ═════════════════════════════════════════════════════════════════════════════

describe("[BF-6] analyzeBitVsHex — 분석 결과와 실제 패킹의 정합성", () => {
  it("totalBitWidth === createBitFieldLayout.totalBits", () => {
    const specs = [
      { name: "prefix",  maxValue: 15 },
      { name: "version", maxValue: 7 },
      { name: "shard",   maxValue: 3 },
      { name: "index",   maxValue: 99999 },
    ];

    const analysis = analyzeBitVsHex(specs);
    const layout = createBitFieldLayout(specs);

    expect(analysis.totalBitWidth).toBe(layout.totalBits);
  });

  it("각 필드의 bitWidth === layout.fields[i].bits", () => {
    const specs = [
      { name: "a", maxValue: 100 },
      { name: "b", maxValue: 7 },
      { name: "c", maxValue: 1000 },
    ];

    const analysis = analyzeBitVsHex(specs);
    const layout = createBitFieldLayout(specs);

    for (let i = 0; i < specs.length; i++) {
      expect(analysis.fields[i].bitWidth).toBe(layout.fields[i].bits);
    }
  });

  it("savedBits만큼 실제 용량 증가 확인", () => {
    // version(max 5): bit=3, hex=4 → 1 bit 절약
    // shard(max 3): bit=2, hex=4 → 2 bits 절약
    const metaSpecs = [
      { name: "version", maxValue: 5 },
      { name: "shard",   maxValue: 3 },
    ];
    const analysis = analyzeBitVsHex(metaSpecs);
    expect(analysis.savedBits).toBe(3); // 1 + 2

    // bit-level: 3+2 = 5 bits → index에 추가 가능
    // hex-level: 4+4 = 8 bits → 3 bits 낭비

    // 동일 컨테이너(16 bits)에서 index 필드 용량 비교
    const containerBits = 16;
    const bitIndexBits = containerBits - analysis.totalBitWidth;  // 16 - 5 = 11
    const hexIndexBits = containerBits - analysis.totalHexWidth;  // 16 - 8 = 8

    const bitCapacity = 2 ** bitIndexBits;   // 2^11 = 2048
    const hexCapacity = 2 ** hexIndexBits;   // 2^8  = 256

    // 절약된 비트로 인한 용량 배수 = 2^savedBits
    expect(bitCapacity / hexCapacity).toBe(analysis.capacityMultiplier);
  });

  it("bits 오버라이드 포함 분석", () => {
    const specs = [
      { name: "prefix",  maxValue: 15 },
      { name: "index",   maxValue: 0, bits: 60 },
    ];
    const analysis = analyzeBitVsHex(specs);
    const layout = createBitFieldLayout(specs);

    expect(analysis.totalBitWidth).toBe(layout.totalBits);
    expect(analysis.fields[1].bitWidth).toBe(60);
    // hex: ceil(60/4) = 15 hex chars = 60 bits → 0 saved
    expect(analysis.fields[1].savedBits).toBe(0);
  });
});
