// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WeightedIndex } from './weighted-index.js';
import {
  WeightedIndexError,
  ShapeError,
  CoordError,
  IndexRangeError,
  BufferError,
} from './errors.js';

// ── 픽스처 ────────────────────────────────────────────────────────────────────
const W342 = new WeightedIndex([3, 4, 2]);
const W4482 = new WeightedIndex([4, 4, 8, 2], ['role', 'action', 'api', 'tenant']);

// ─────────────────────────────────────────────────────────────────────────────
// [불변식] 전단사 증명 (bijection)
//   "가중진법으로 만든 index는 [0, size-1] 범위 내에서 전단사(bijection)이다"
// ─────────────────────────────────────────────────────────────────────────────
describe('[불변식] 전단사 증명 (bijection)', () => {
  it('단사(injective): 모든 좌표 조합이 서로 다른 index를 만든다', () => {
    const seen = new Set<number>();
    for (let r = 1; r <= 3; r++)
      for (let a = 1; a <= 4; a++)
        for (let t = 1; t <= 2; t++) {
          const idx = W342.encode([r, a, t]);
          expect(seen.has(idx)).toBe(false);
          seen.add(idx);
        }
    expect(seen.size).toBe(W342.size);
  });

  it('전사(surjective): [0, size-1] 의 모든 정수가 어떤 좌표에 대응된다', () => {
    const produced = new Set<number>();
    for (let r = 1; r <= 3; r++)
      for (let a = 1; a <= 4; a++)
        for (let t = 1; t <= 2; t++) produced.add(W342.encode([r, a, t]));
    for (let i = 0; i < W342.size; i++) expect(produced.has(i)).toBe(true);
  });

  it('encode ∘ decode = identity', () => {
    for (let i = 0; i < W342.size; i++) {
      expect(W342.encode(W342.decode(i))).toBe(i);
    }
  });

  it('decode ∘ encode = identity', () => {
    for (let r = 1; r <= 3; r++)
      for (let a = 1; a <= 4; a++)
        for (let t = 1; t <= 2; t++) {
          const coords = [r, a, t];
          expect(W342.decode(W342.encode(coords))).toEqual(coords);
        }
  });

  it('1차원 edge case: shape [N] → index = x-1', () => {
    const wi = new WeightedIndex([5]);
    for (let x = 1; x <= 5; x++) {
      expect(wi.encode([x])).toBe(x - 1);
      expect(wi.decode(x - 1)).toEqual([x]);
    }
  });

  it('index 범위는 항상 [0, size-1]', () => {
    const indices: number[] = [];
    for (let a = 1; a <= 3; a++)
      for (let b = 1; b <= 4; b++)
        for (let c = 1; c <= 2; c++) indices.push(W342.encode([a, b, c]));
    expect(Math.min(...indices)).toBe(0);
    expect(Math.max(...indices)).toBe(W342.size - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [경계값] 최솟값 / 최댓값 / 단일 원소
// ─────────────────────────────────────────────────────────────────────────────
describe('[경계값] 최솟값/최댓값/단일 원소', () => {
  it('index=0: 모든 차원 최솟값(1)으로 decode', () => {
    expect(W342.decode(0)).toEqual([1, 1, 1]);
  });

  it('index=size-1: 모든 차원 최댓값으로 decode', () => {
    expect(W342.decode(W342.size - 1)).toEqual([3, 4, 2]);
  });

  it('최솟값 coords → index=0', () => {
    expect(new WeightedIndex([5, 6, 7]).encode([1, 1, 1])).toBe(0);
  });

  it('최댓값 coords → index=size-1', () => {
    expect(W342.encode([3, 4, 2])).toBe(W342.size - 1);
  });

  it('size=1: shape [1] — index=0 만 존재', () => {
    const wi = new WeightedIndex([1]);
    expect(wi.size).toBe(1);
    expect(wi.encode([1])).toBe(0);
    expect(wi.decode(0)).toEqual([1]);
  });

  it('size=1: shape [1,1,1] 도 index=0 만 존재', () => {
    const wi = new WeightedIndex([1, 1, 1]);
    expect(wi.size).toBe(1);
    expect(wi.encode([1, 1, 1])).toBe(0);
  });

  it('encodeFromRecord: 여분의 key는 무시', () => {
    const wi = new WeightedIndex([3, 4], ['role', 'action']);
    expect(wi.encodeFromRecord({ role: 2, action: 3, extra: 99 } as Record<string, number>)).toBe(
      wi.encode([2, 3]),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [동치 분할] 입력 유효성 — 유효 / 무효 입력 분류
// ─────────────────────────────────────────────────────────────────────────────
describe('[동치 분할] 입력 유효성', () => {
  it('빈 shape 거부', () => {
    expect(() => new WeightedIndex([])).toThrow('at least one element');
  });

  it('shape에 0 이하 값 거부', () => {
    expect(() => new WeightedIndex([3, 0, 2])).toThrow('positive integer');
  });

  it('labels 길이 불일치 거부', () => {
    expect(() => new WeightedIndex([3, 4], ['only_one'] as unknown as [string, string])).toThrow(
      'labels length',
    );
  });

  it('범위 초과 coords 거부', () => {
    const wi = new WeightedIndex([3, 4]);
    expect(() => wi.encode([4, 1])).toThrow('coords[0]');
    expect(() => wi.encode([0, 1])).toThrow('coords[0]');
  });

  it('범위 초과 index 거부', () => {
    expect(() => W342.decode(W342.size)).toThrow('index must be in');
    expect(() => W342.decode(-1)).toThrow('index must be in');
  });

  it('encodeFromRecord: 누락된 key 거부', () => {
    const wi = new WeightedIndex([3, 4], ['role', 'action']);
    expect(() => wi.encodeFromRecord({ role: 1 })).toThrow('Missing key "action"');
  });

  it('NaN coords 거부', () => {
    expect(() => W342.encode([NaN, 1, 1])).toThrow('coords[0]');
  });

  it('Infinity coords 거부', () => {
    expect(() => W342.encode([Infinity, 1, 1])).toThrow('coords[0]');
    expect(() => W342.encode([1, -Infinity, 1])).toThrow('coords[1]');
  });

  it('소수 coords 거부', () => {
    expect(() => W342.encode([1.5, 1, 1])).toThrow('coords[0]');
  });

  it('coords 배열 길이 불일치 거부', () => {
    expect(() => W342.encode([1, 2])).toThrow('coords length');
    expect(() => W342.encode([1, 2, 1, 1])).toThrow('coords length');
  });

  it('비정수 / NaN index 거부', () => {
    expect(() => W342.decode(1.5)).toThrow('index must be in');
    expect(() => W342.decode(NaN)).toThrow('index must be in');
  });

  it('decodeTo: 버퍼 길이 부족 거부', () => {
    expect(() => W342.decodeTo(0, [0, 0])).toThrow('out buffer length');
  });

  it('size > MAX_SAFE_INTEGER 거부', () => {
    expect(() => new WeightedIndex([Number.MAX_SAFE_INTEGER, 2])).toThrow('MAX_SAFE_INTEGER');
  });

  it('중간 weight가 MAX_SAFE_INTEGER를 초과하면 ShapeError', () => {
    // shape[0] * shape[1] = (MAX_SAFE_INTEGER/2 + 1) * 2 > MAX_SAFE_INTEGER
    // weight[0] = shape[1] = MAX_SAFE_INTEGER/2 + 1 → 자체는 OK
    // 하지만 size = weight[0] * shape[0] 가 MAX_SAFE_INTEGER 초과
    // 이 케이스는 기존 size 체크로 잡힘.
    // 진짜 문제: weight 계산 중간값이 overflow되는 케이스
    const huge = Math.pow(2, 27); // 134_217_728
    // huge * huge = 2^54 > MAX_SAFE_INTEGER (2^53 - 1)
    // weight[0] = huge * huge 가 중간 계산에서 overflow됨
    expect(() => new WeightedIndex([2, huge, huge])).toThrow('MAX_SAFE_INTEGER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [에러 계층] instanceof 타입 검증
//   라이브러리 사용자가 catch 분기에서 instanceof 로 에러를 구분할 수 있어야 한다.
// ─────────────────────────────────────────────────────────────────────────────
describe('[에러 계층] instanceof 타입 검증', () => {
  it('빈 shape → ShapeError extends WeightedIndexError', () => {
    try {
      const _wi = new WeightedIndex([]);
    } catch (e) {
      expect(e).toBeInstanceOf(ShapeError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('ShapeError');
    }
  });

  it('범위 초과 coords → CoordError extends WeightedIndexError', () => {
    try {
      W342.encode([99, 1, 1]);
    } catch (e) {
      expect(e).toBeInstanceOf(CoordError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('CoordError');
    }
  });

  it('범위 초과 index → IndexRangeError extends WeightedIndexError', () => {
    try {
      W342.decode(9999);
    } catch (e) {
      expect(e).toBeInstanceOf(IndexRangeError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('IndexRangeError');
    }
  });

  it('버퍼 길이 부족 → BufferError extends WeightedIndexError', () => {
    try {
      W342.decodeTo(0, [0]);
    } catch (e) {
      expect(e).toBeInstanceOf(BufferError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('BufferError');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [공개 속성] strides — 차원별 가중치 노출
//
// API 서버에서 수동 stride 계산 (`const STRIDE = 7 * 2;`)을 제거하기 위해
// WeightedIndex.strides를 public readonly로 노출한다.
// ─────────────────────────────────────────────────────────────────────────────
describe('[공개 속성] strides', () => {
  it('strides[i] = product(shape[i+1:])', () => {
    // shape [3, 4, 2] → strides [8, 2, 1]
    expect(W342.strides).toEqual([8, 2, 1]);
  });

  it('calcWeights와 동일한 결과', () => {
    // strides는 calcWeights(shape) 결과와 동일해야 한다
    // shape [3, 4, 2] → weights [8, 2, 1]
    expect(W342.strides).toEqual([8, 2, 1]);
    // shape [4, 4, 8, 2] → weights [64, 16, 2, 1]
    expect(W4482.strides).toEqual([64, 16, 2, 1]);
  });

  it('4차원: shape [4, 4, 8, 2]', () => {
    // strides: [4*8*2=64, 8*2=16, 2, 1]
    expect(W4482.strides).toEqual([64, 16, 2, 1]);
  });

  it('단일 차원: shape [5] → strides [1]', () => {
    const wi = new WeightedIndex([5]);
    expect(wi.strides).toEqual([1]);
  });

  it('frozen 배열이다 (불변)', () => {
    expect(Object.isFrozen(W342.strides)).toBe(true);
  });

  it('strides를 사용해 특정 차원의 좌표 변화량을 계산할 수 있다', () => {
    // event index 시나리오: shape [10, 7, 2] (svc × event × initiator)
    const wi = new WeightedIndex([10, 7, 2], ['svc', 'event', 'initiator']);
    // strides: [14, 2, 1]
    expect(wi.strides).toEqual([14, 2, 1]);

    // svc가 1 증가하면 address가 14 증가
    const base = wi.encode([1, 1, 1]); // 0
    const nextSvc = wi.encode([2, 1, 1]); // 14
    expect(nextSvc - base).toBe(wi.strides[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [성능 API] unsafe / buffer 변형
// ─────────────────────────────────────────────────────────────────────────────
describe('[성능 API] unsafe/buffer 변형', () => {
  it('encodeUnsafe: 유효 입력에서 safe 버전과 동일한 결과', () => {
    for (let r = 1; r <= 4; r++)
      for (let a = 1; a <= 4; a++) {
        const coords = [r, a, 3, 2];
        expect(W4482.encodeUnsafe(coords)).toBe(W4482.encode(coords));
      }
  });

  it('decodeUnsafe: 유효 입력에서 safe 버전과 동일한 결과', () => {
    for (let i = 0; i < W4482.size; i += 17) expect(W4482.decodeUnsafe(i)).toEqual(W4482.decode(i));
  });

  it('decodeTo: 미리 할당된 버퍼에 기록', () => {
    const buf = new Array<number>(4);
    W4482.decodeTo(42, buf);
    expect(buf).toEqual(W4482.decode(42));
  });

  it('decodeTo: 버퍼 재사용 시 매번 올바른 값 기록', () => {
    const buf = new Array<number>(4);
    for (let i = 0; i < 20; i++) {
      W4482.decodeTo(i, buf);
      expect(buf).toEqual(W4482.decode(i));
    }
  });

  it('decodeToUnsafe: 유효 입력에서 safe 버전과 동일한 결과', () => {
    const buf = new Array<number>(4);
    for (let i = 0; i < W4482.size; i += 13) {
      W4482.decodeToUnsafe(i, buf);
      expect(buf).toEqual(W4482.decode(i));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [시나리오] 권한 시스템 메타데이터 매핑
// ─────────────────────────────────────────────────────────────────────────────
describe('[시나리오] 권한 시스템 메타데이터 매핑', () => {
  // API 권한: role(3) × action(4) × api(8) × tenant(2)
  const API = new WeightedIndex([3, 4, 8, 2], ['role', 'action', 'api', 'tenant']);
  // Page 권한: role(3) × page(12) × tenant(2)
  const PAGE = new WeightedIndex([3, 12, 2], ['role', 'page', 'tenant']);

  it('size 계산: 3*4*8*2=192, 3*12*2=72', () => {
    expect(API.size).toBe(192);
    expect(PAGE.size).toBe(72);
  });

  it('encodeFromRecord / decodeToRecord 왕복', () => {
    const rec = { role: 2, action: 3, api: 5, tenant: 1 };
    expect(API.decodeToRecord(API.encodeFromRecord(rec))).toEqual(rec);
  });

  it('perm_id set으로 권한 확인', () => {
    const adminPerms = new Set<number>();
    for (const action of [1, 2])
      for (let api = 1; api <= 8; api++) adminPerms.add(API.encode([3, action, api, 1]));

    expect(adminPerms.has(API.encodeFromRecord({ role: 3, action: 1, api: 3, tenant: 1 }))).toBe(
      true,
    );
    expect(adminPerms.has(API.encodeFromRecord({ role: 3, action: 3, api: 1, tenant: 1 }))).toBe(
      false,
    );
  });

  it('perm_id 역산: index → 사람이 읽을 수 있는 레코드', () => {
    expect(API.decodeToRecord(API.encode([1, 2, 4, 2]))).toEqual({
      role: 1,
      action: 2,
      api: 4,
      tenant: 2,
    });
  });

  it('두 도메인(api, page)의 perm_id는 독립적으로 관리', () => {
    const apiIdx = API.encode([1, 1, 1, 1]); // 0
    const pageIdx = PAGE.encode([1, 1, 1]); // 0
    expect(API.decodeToRecord(apiIdx)).toEqual({ role: 1, action: 1, api: 1, tenant: 1 });
    expect(PAGE.decodeToRecord(pageIdx)).toEqual({ role: 1, page: 1, tenant: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [속성 기반] 랜덤 입력 불변식 (fast-check)
//   임의의 shape / coords / index 에서 핵심 속성이 항상 성립해야 한다.
// ─────────────────────────────────────────────────────────────────────────────
describe('[속성 기반] 랜덤 입력 불변식', () => {
  /** 유효한 shape (size ≤ MAX_SAFE_INTEGER) 생성기 */
  const validShape = fc
    .array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 6 })
    .filter((s) => s.reduce((a, b) => a * b, 1) <= Number.MAX_SAFE_INTEGER);

  it('encode(decode(index)) = index — 임의 shape, 임의 index', () => {
    fc.assert(
      fc.property(validShape, fc.nat(), (shape, seed) => {
        const wi = new WeightedIndex(shape);
        const index = seed % wi.size;
        expect(wi.encode(wi.decode(index))).toBe(index);
      }),
      { numRuns: 200 },
    );
  });

  it('decode(encode(coords)) = coords — 임의 shape, 임의 coords', () => {
    fc.assert(
      fc.property(
        validShape,
        fc.array(fc.nat(), { minLength: 6, maxLength: 6 }),
        (shape, randoms) => {
          const wi = new WeightedIndex(shape);
          const coords = shape.map((n, i) => (randoms[i] % n) + 1);
          expect(wi.decode(wi.encode(coords))).toEqual(coords);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('모든 encode 결과는 [0, size-1] 범위 내', () => {
    fc.assert(
      fc.property(
        validShape,
        fc.array(fc.nat(), { minLength: 6, maxLength: 6 }),
        (shape, randoms) => {
          const wi = new WeightedIndex(shape);
          const coords = shape.map((n, i) => (randoms[i] % n) + 1);
          const index = wi.encode(coords);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(wi.size);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('it.each — 다양한 shape 조합에서 size = Π N_i', () => {
    const cases: [number[], number][] = [
      [[2], 2],
      [[3, 4], 12],
      [[3, 4, 2], 24],
      [[2, 3, 4, 5], 120],
      [[1, 1, 1, 1], 1],
      [[10, 10, 10], 1000],
    ];
    for (const [shape, expected] of cases) {
      expect(new WeightedIndex(shape).size).toBe(expected);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [extractDims] label 기반 부분 decode
// ─────────────────────────────────────────────────────────────────────────────
describe('extractDims', () => {
  const wi = new WeightedIndex([8, 4, 5, 4], ['env', 'region', 'svc', 'ns']);

  it('label로 부분 추출', () => {
    const addr = wi.encode([3, 2, 4, 1]);
    const result = wi.extractDims(addr, ['env', 'svc']);
    expect(result).toEqual({ env: 3, svc: 4 });
  });

  it('전체 label → decodeToRecord와 동일', () => {
    const addr = wi.encode([3, 2, 4, 1]);
    const full = wi.decodeToRecord(addr);
    const partial = wi.extractDims(addr, ['env', 'region', 'svc', 'ns']);
    expect(partial).toEqual(full);
  });

  it('단일 label 추출', () => {
    const addr = wi.encode([1, 3, 5, 4]);
    expect(wi.extractDims(addr, ['ns'])).toEqual({ ns: 4 });
  });

  it('미존재 label → 에러', () => {
    expect(() => wi.extractDims(0, ['unknown'])).toThrow('Unknown label');
  });
});
