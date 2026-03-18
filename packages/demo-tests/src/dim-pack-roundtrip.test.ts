/**
 * dim-pack-roundtrip.test.ts — BitIndex 데이터 변환 라운드트립 검증
 *
 * WeightedIndex(mixed-radix)와 BitIndex(per-dimension bit-pack)의
 * 변환 경로가 각각 독립적으로 보존되고, 교차 검증이 가능한지 확인한다.
 *
 * ── 변환 경로 맵 ──────────────────────────────────────────────────────────
 *
 *   좌표 (coords)
 *     │
 *     ├─ WeightedIndex.encode() → 1D index (compact, O(d) decode)
 *     │
 *     └─ BitIndex.encode()  → packed bits (O(1) extractDim)
 *           │
 *           ├─ extractDim(packed, i)         → 단일 차원 (shift+mask)
 *           ├─ extractDims(packed, [i,j,k])  → 부분 집합
 *           ├─ toHex(coords)   → hex string  → fromHex() → coords
 *           └─ toBytes(coords) → Uint8Array  → fromBytes() → coords
 *
 * ── 섹션 ──────────────────────────────────────────────────────────────────
 *
 * [DP-1] 좌표 보존: encode → decode 라운드트립 (Number + BigInt)
 * [DP-2] O(1) 추출: extractDim == full decode 의 부분집합
 * [DP-3] 직렬화 교차: hex / bytes 라운드트립
 * [DP-4] WeightedIndex 교차: 두 인코딩이 같은 좌표를 독립 복원
 * [DP-5] 실사용: 권한 시스템 캐시 키 그룹핑
 */

import { describe, it, expect } from "vitest";
import { BitIndex, BitIndexBig } from "bit-index";
import { WeightedIndex } from "weighted-index";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const SHAPE = [10, 50, 8, 20];
const LABELS = ["region", "page", "action", "resource"];

// ═════════════════════════════════════════════════════════════════════════════
//  [DP-1] 좌표 보존
// ═════════════════════════════════════════════════════════════════════════════

describe("[DP-1] 좌표 보존 — encode → decode 라운드트립", () => {
  const idx = new BitIndex(SHAPE, LABELS);

  const testCoords: number[][] = [
    [1, 1, 1, 1],
    [10, 50, 8, 20],
    [5, 25, 4, 10],
    [1, 50, 8, 20],
    [10, 1, 1, 1],
  ];

  for (const coords of testCoords) {
    it(`Number: [${coords}]`, () => {
      expect(idx.decode(idx.encode(coords))).toEqual(coords);
    });
  }

  it("Number: 100건 랜덤 라운드트립", () => {
    for (let i = 0; i < 100; i++) {
      const coords = SHAPE.map(s => Math.floor(Math.random() * s) + 1);
      expect(idx.decode(idx.encode(coords))).toEqual(coords);
    }
  });

  it("BigInt: 경계값 라운드트립", () => {
    const bigIdx = new BitIndexBig(SHAPE, LABELS);
    for (const coords of testCoords) {
      expect(bigIdx.decode(bigIdx.encode(coords))).toEqual(coords);
    }
  });

  it("BigInt: 대규모 shape (totalBits > 53)", () => {
    const bigShape = new Array(18).fill(8); // 18 × 3 = 54 bits
    const bigIdx = new BitIndexBig(bigShape);
    const coords = Array.from({ length: 18 }, (_, i) => (i % 7) + 1);
    expect(bigIdx.decode(bigIdx.encode(coords))).toEqual(coords);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [DP-2] O(1) 추출 == full decode 부분집합
// ═════════════════════════════════════════════════════════════════════════════

describe("[DP-2] extractDim/extractDims == decode 부분집합", () => {
  const idx = new BitIndex(SHAPE, LABELS);

  it("100건 랜덤: 모든 차원 extractDim == decode[i]", () => {
    for (let t = 0; t < 100; t++) {
      const coords = SHAPE.map(s => Math.floor(Math.random() * s) + 1);
      const packed = idx.encode(coords);
      const decoded = idx.decode(packed);

      for (let i = 0; i < SHAPE.length; i++) {
        expect(idx.extractDim(packed, i)).toBe(decoded[i]);
      }
    }
  });

  it("extractDims 부분 추출 == decodeToRecord 부분", () => {
    const coords = [3, 25, 5, 12];
    const packed = idx.encode(coords);
    const full = idx.decodeToRecord(packed);
    const subset = idx.extractDimsByLabel(packed, ["region", "action"]);

    expect(subset).toEqual({ region: full.region, action: full.action });
  });

  it("BigInt 경로에서도 동일", () => {
    const bigIdx = new BitIndexBig(SHAPE, LABELS);
    const coords = [7, 42, 3, 18];
    const packed = bigIdx.encode(coords);

    for (let i = 0; i < SHAPE.length; i++) {
      expect(bigIdx.extractDim(packed, i)).toBe(coords[i]);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [DP-3] 직렬화 교차: hex / bytes
// ═════════════════════════════════════════════════════════════════════════════

describe("[DP-3] 직렬화 교차 라운드트립", () => {
  const idx = new BitIndex(SHAPE, LABELS);
  const coords = [3, 25, 5, 12];

  it("hex → fromHex → extractDim 정확", () => {
    const hex = idx.toHex(coords);
    const restored = idx.fromHex(hex);
    expect(restored).toEqual(coords);

    const packed = idx.encode(coords);
    const packedFromHex = idx.encode(idx.fromHex(hex));
    expect(packedFromHex).toBe(packed);
  });

  it("bytes → fromBytes → extractDim 정확", () => {
    const bytes = idx.toBytes(coords);
    const restored = idx.fromBytes(bytes);
    expect(restored).toEqual(coords);
  });

  it("hex → bytes → hex 교차", () => {
    const hex = idx.toHex(coords);
    const bytes = idx.toBytes(idx.fromHex(hex));
    const hex2 = idx.toHex(idx.fromBytes(bytes));
    expect(hex2).toBe(hex);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [DP-4] WeightedIndex 교차 — 두 인코딩이 같은 좌표를 독립 복원
// ═════════════════════════════════════════════════════════════════════════════

describe("[DP-4] WeightedIndex vs BitIndex — 독립 복원", () => {
  const wi = new WeightedIndex(SHAPE, LABELS);
  const dp = new BitIndex(SHAPE, LABELS);

  it("100건: 두 경로 각각 encode→decode 동일 좌표 복원", () => {
    for (let i = 0; i < 100; i++) {
      const coords = SHAPE.map(s => Math.floor(Math.random() * s) + 1);

      const wiIndex = wi.encode(coords);
      const dpPacked = dp.encode(coords);

      expect(wi.decode(wiIndex)).toEqual(coords);
      expect(dp.decode(dpPacked)).toEqual(coords);
    }
  });

  it("packed 값은 서로 다름 (의도된 비호환)", () => {
    const coords = [5, 25, 4, 10];
    expect(wi.encode(coords)).not.toBe(dp.encode(coords));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [DP-5] 실사용: 권한 시스템 캐시 키 그룹핑
// ═════════════════════════════════════════════════════════════════════════════

describe("[DP-5] 실사용 — region+page 캐시 키 그룹핑", () => {
  const idx = new BitIndex(
    [3, 10, 4, 50, 8],
    ["namespace", "service", "type", "resource", "action"],
  );

  it("같은 namespace+service → 다른 type/resource/action에 관계없이 동일 부분 추출", () => {
    const packedA = idx.encode([2, 5, 1, 1, 1]);
    const packedB = idx.encode([2, 5, 4, 50, 8]);

    expect(idx.extractDimsByLabel(packedA, ["namespace", "service"]))
      .toEqual(idx.extractDimsByLabel(packedB, ["namespace", "service"]));
  });

  it("비트 시프트로 상위 그룹 직접 비교 가능", () => {
    // namespace(2b) + service(4b) = 상위 6 bits
    // type(2b) + resource(6b) + action(3b) = 하위 11 bits
    const lowerBits = 2 + 6 + 3; // type + resource + action

    const packedA = idx.encode([2, 5, 1, 1, 1]);
    const packedB = idx.encode([2, 5, 4, 50, 8]);
    const packedC = idx.encode([3, 5, 1, 1, 1]); // 다른 namespace

    expect(packedA >> lowerBits).toBe(packedB >> lowerBits); // 같은 그룹
    expect(packedA >> lowerBits).not.toBe(packedC >> lowerBits); // 다른 그룹
  });
});
