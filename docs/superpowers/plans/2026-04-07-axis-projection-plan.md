# I-6: Axis Projection 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mixed-radix weighted-index에서 특정 차원만 O(k)로 추출하는 partialDecode를 구현하고, Aggregator·catalog runtime·query-service에 적용한다.

**Architecture:** `partialDecode(address, shape, strides, dimIndices)` 순수 함수를 calc.ts에 추가. WeightedIndex.extractDims() 인스턴스 메서드로 노출. catalog runtime에 decodePrefixPartial() 추가. Aggregator에 partialDecodeFn 옵션 주입.

**Tech Stack:** TypeScript, weighted-index, @qa-sdk/core, Vitest

---

### Task 1: partialDecode 순수 함수 (calc.ts)

**Files:**
- Modify: `packages/weighted-index/src/math/calc.ts`
- Modify: `packages/weighted-index/src/math/calc.test.ts`
- Modify: `packages/weighted-index/src/index.ts`

- [ ] **Step 1: calc.test.ts에 partialDecode 테스트 추가**

`packages/weighted-index/src/math/calc.test.ts` 끝에 추가:

```typescript
// ── partialDecode ──────────────────────────────────────────────────────────

describe("partialDecode", () => {
  // shape [8, 4, 5, 4], strides [80, 20, 4, 1]
  const shape = [8, 4, 5, 4];
  const strides = calcWeights(shape);

  it("전체 차원 추출 — full decode와 동일", () => {
    const wi = new WeightedIndex(shape);
    // coords [3, 2, 4, 1] → address = 2*80 + 1*20 + 3*4 + 0*1 = 192
    const addr = wi.encode([3, 2, 4, 1]);
    const result = partialDecode(addr, shape, strides, [0, 1, 2, 3]);
    expect(result).toEqual({ 0: 3, 1: 2, 2: 4, 3: 1 });
  });

  it("단일 차원 추출 (dim 0)", () => {
    const wi = new WeightedIndex(shape);
    const addr = wi.encode([3, 2, 4, 1]);
    const result = partialDecode(addr, shape, strides, [0]);
    expect(result).toEqual({ 0: 3 });
  });

  it("단일 차원 추출 (마지막 dim)", () => {
    const wi = new WeightedIndex(shape);
    const addr = wi.encode([3, 2, 4, 1]);
    const result = partialDecode(addr, shape, strides, [3]);
    expect(result).toEqual({ 3: 1 });
  });

  it("2개 차원 추출 (dim 1, 3)", () => {
    const wi = new WeightedIndex(shape);
    const addr = wi.encode([3, 2, 4, 1]);
    const result = partialDecode(addr, shape, strides, [1, 3]);
    expect(result).toEqual({ 1: 2, 3: 1 });
  });

  it("address 0 → 모든 차원 1", () => {
    const result = partialDecode(0, shape, strides, [0, 1, 2, 3]);
    expect(result).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 });
  });

  it("빈 dimIndices → 빈 객체", () => {
    const result = partialDecode(0, shape, strides, []);
    expect(result).toEqual({});
  });

  it("모든 주소에 대해 full decode와 동치", () => {
    const wi = new WeightedIndex([3, 4, 2]);
    const s = calcWeights([3, 4, 2]);
    for (let addr = 0; addr < wi.size; addr++) {
      const full = wi.decode(addr);
      const partial = partialDecode(addr, [3, 4, 2], s, [0, 1, 2]);
      expect(partial[0]).toBe(full[0]);
      expect(partial[1]).toBe(full[1]);
      expect(partial[2]).toBe(full[2]);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter weighted-index test -- --run calc.test`
Expected: FAIL — `partialDecode` not found

- [ ] **Step 3: partialDecode 구현**

`packages/weighted-index/src/math/calc.ts`의 `partialQueryBase` 함수 뒤에 추가:

```typescript
/**
 * 특정 차원만 추출하는 부분 decode. O(k) — k = dimIndices 수.
 *
 * mixed-radix에서 i번째 차원 좌표 독립 추출 공식:
 *   coord_i = floor(address / stride[i]) % shape[i] + 1
 *
 * full decode O(d) 대비 k << d 일 때 유리.
 *
 * @param address    - 1D 주소 (0-based)
 * @param shape      - 각 차원의 크기 배열
 * @param strides    - calcWeights(shape) 결과
 * @param dimIndices - 추출할 차원 인덱스 (0-based)
 * @returns { dimIndex: coord(1-based) } 맵
 */
export function partialDecode(
  address: number,
  shape: readonly number[],
  strides: readonly number[],
  dimIndices: readonly number[],
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const i of dimIndices) {
    result[i] = Math.floor(address / strides[i]) % shape[i] + 1;
  }
  return result;
}
```

- [ ] **Step 4: index.ts에 export 추가**

`packages/weighted-index/src/index.ts`의 calc.js export 블록에 `partialDecode` 추가:

```typescript
export {
  calcWeights,
  partialQueryBase,
  partialDecode,          // ← 추가
  describeRangeFormula,
  // ... 기존 exports
} from "./math/calc.js";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter weighted-index test -- --run calc.test`
Expected: 기존 + 7개 신규 테스트 PASS

- [ ] **Step 6: 빌드**

Run: `pnpm --filter weighted-index build`

- [ ] **Step 7: Commit**

```bash
git add packages/weighted-index/src/math/calc.ts packages/weighted-index/src/math/calc.test.ts packages/weighted-index/src/index.ts
git commit -m "feat(weighted-index): add partialDecode — O(k) partial dimension extraction

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: WeightedIndex.extractDims 인스턴스 메서드

**Files:**
- Modify: `packages/weighted-index/src/math/weighted-index.ts`
- Modify: `packages/weighted-index/src/math/weighted-index.test.ts`

- [ ] **Step 1: weighted-index.test.ts에 extractDims 테스트 추가**

`packages/weighted-index/src/math/weighted-index.test.ts` 끝에 추가:

```typescript
describe("extractDims", () => {
  const wi = new WeightedIndex([8, 4, 5, 4], ["env", "region", "svc", "ns"]);

  it("label로 부분 추출", () => {
    const addr = wi.encode([3, 2, 4, 1]);
    const result = wi.extractDims(addr, ["env", "svc"]);
    expect(result).toEqual({ env: 3, svc: 4 });
  });

  it("전체 label → decodeToRecord와 동일", () => {
    const addr = wi.encode([3, 2, 4, 1]);
    const full = wi.decodeToRecord(addr);
    const partial = wi.extractDims(addr, ["env", "region", "svc", "ns"]);
    expect(partial).toEqual(full);
  });

  it("단일 label 추출", () => {
    const addr = wi.encode([1, 3, 5, 4]);
    expect(wi.extractDims(addr, ["ns"])).toEqual({ ns: 4 });
  });

  it("미존재 label → 에러", () => {
    expect(() => wi.extractDims(0, ["unknown"])).toThrow();
  });
});
```

- [ ] **Step 2: extractDims 구현**

`packages/weighted-index/src/math/weighted-index.ts`의 `decodeToRecord` 메서드 뒤에 추가:

```typescript
  /**
   * 요청한 labels에 해당하는 차원만 부분 decode. O(k).
   * full decodeToRecord() 대비 k << d 일 때 유리.
   */
  extractDims(address: number, labels: string[]): Record<string, number> {
    this._validateIndex(address);
    const result: Record<string, number> = {};
    for (const label of labels) {
      const i = this.labels.indexOf(label);
      if (i < 0) {
        throw new CoordError(`Unknown label "${label}" in extractDims`);
      }
      result[label] = Math.floor(address / this.strides[i]) % this.shape[i] + 1;
    }
    return result;
  }
```

- [ ] **Step 3: 테스트 통과**

Run: `pnpm --filter weighted-index test -- --run weighted-index.test`
Expected: 기존 + 4개 PASS

- [ ] **Step 4: Commit**

```bash
git add packages/weighted-index/src/math/weighted-index.ts packages/weighted-index/src/math/weighted-index.test.ts
git commit -m "feat(weighted-index): add WeightedIndex.extractDims — label-based partial decode

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: catalog runtime decodePrefixPartial

**Files:**
- Modify: `packages/core/src/catalog/runtime.ts`
- Modify: `packages/core/src/index.ts` (export 추가)

- [ ] **Step 1: decodePrefixPartial 구현**

`packages/core/src/catalog/runtime.ts`의 `decodePrefix` 함수 뒤에 추가:

```typescript
/**
 * prefix 1D 주소에서 요청한 labels만 부분 decode. O(k).
 * 전체 decodePrefix() O(d) 대비 k << d 일 때 유리.
 *
 * @param labels - 추출할 차원 label 목록 (getFixedLabels 범위 내)
 */
export function decodePrefixPartial(
  catalog: Catalog, prefixId: string, version: string,
  address: number, labels: string[],
): Record<string, DecodedPosition> {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);
  const fixedLabels = getFixedLabels(prefix);
  const { shape, strides } = getShapeAndStrides(catalog, prefixId, version);

  const labelSet = new Set(labels);
  const result: Record<string, DecodedPosition> = {};

  for (let i = 0; i < fixedLabels.length; i++) {
    const label = fixedLabels[i];
    if (!labelSet.has(label)) continue;

    // O(1) per dim: floor(address / stride) % shape + offset
    const pos = Math.floor(address / strides[i]) % shape[i];

    const dim = prefix.dims[label];
    let value: string | number;
    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      const snap = axis.versions[vdef.axisVersions[label]];
      value = pos < snap.entries.length ? snap.entries[pos] : `(reserved:${pos})`;
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      value = ref ? ref.values[pos] : pos;
    } else {
      continue;
    }
    result[label] = { position: pos, value };
  }
  return result;
}
```

- [ ] **Step 2: core/index.ts에 export 추가**

`packages/core/src/index.ts`에서 기존 `decodePrefix` export 라인을 찾아 `decodePrefixPartial` 추가.

- [ ] **Step 3: 빌드**

Run: `pnpm --filter @qa-sdk/core build`

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/catalog/runtime.ts packages/core/src/index.ts
git commit -m "feat(core): add decodePrefixPartial — O(k) catalog prefix partial decode

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Aggregator.projectAxis 최적화

**Files:**
- Modify: `packages/core/src/ports/aggregator.port.ts`
- Modify: `packages/store/src/adapters/memory/aggregator.adapter.ts`
- Modify: `packages/store/src/adapters/memory/aggregator.adapter.test.ts`

- [ ] **Step 1: aggregator.port.ts에 partialDecodeFn 옵션 추가**

`packages/core/src/ports/aggregator.port.ts`에서 Aggregator 인터페이스의 생성자/설정에 partialDecodeFn 옵션이 필요하면 추가. 포트 인터페이스 자체는 변경하지 않고 구현 레벨에서 주입.

실제로는 InMemoryAggregator의 constructor에 `partialDecodeFn` 옵션을 추가:

```typescript
// aggregator.adapter.ts constructor
constructor(opts?: {
  maxSize?: number;
  decodeFn?: (key: string) => Record<string, string> | null;
  partialDecodeFn?: (key: string, axes: string[]) => Record<string, string> | null;
})
```

- [ ] **Step 2: projectAxis에서 partialDecodeFn 사용**

`packages/store/src/adapters/memory/aggregator.adapter.ts`의 projectAxis 메서드에서:

```typescript
// 기존
const decoded = this.decodeFn(item.key);

// 최적화 — partialDecodeFn이 있으면 사용
const decoded = this.partialDecodeFn
  ? this.partialDecodeFn(item.key, axes as string[])
  : this.decodeFn(item.key);
```

- [ ] **Step 3: 테스트 — partialDecodeFn 주입 시 결과 동일**

`packages/store/src/adapters/memory/aggregator.adapter.test.ts`에 추가:

```typescript
it("partialDecodeFn 주입 시 projectAxis 결과 동일", async () => {
  const fullDecode = (key: string) => ({ env: key.split(":")[0], region: key.split(":")[1] });
  const partialDecode = (key: string, axes: string[]) => {
    const parts = key.split(":");
    const result: Record<string, string> = {};
    if (axes.includes("env")) result.env = parts[0];
    if (axes.includes("region")) result.region = parts[1];
    return result;
  };

  const agg1 = new InMemoryAggregator({ decodeFn: fullDecode });
  const agg2 = new InMemoryAggregator({ decodeFn: fullDecode, partialDecodeFn: partialDecode });

  // 동일 데이터 주입
  agg1.ingest({ key: "prod:us", timestamp: "2026-01-01T00:00:00Z" });
  agg1.ingest({ key: "prod:eu", timestamp: "2026-01-01T00:00:01Z" });
  agg1.ingest({ key: "dev:us", timestamp: "2026-01-01T00:00:02Z" });
  agg2.ingest({ key: "prod:us", timestamp: "2026-01-01T00:00:00Z" });
  agg2.ingest({ key: "prod:eu", timestamp: "2026-01-01T00:00:01Z" });
  agg2.ingest({ key: "dev:us", timestamp: "2026-01-01T00:00:02Z" });

  const r1 = await agg1.projectAxis(["prod:us", "prod:eu", "dev:us"], ["env"]);
  const r2 = await agg2.projectAxis(["prod:us", "prod:eu", "dev:us"], ["env"]);
  expect(r2).toEqual(r1);
});
```

- [ ] **Step 4: 테스트 통과**

Run: `pnpm --filter @qa-sdk/store test -- --run aggregator`
Expected: 기존 + 1 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/adapters/memory/aggregator.adapter.ts packages/store/src/adapters/memory/aggregator.adapter.test.ts
git commit -m "feat(store): optimize Aggregator.projectAxis with partialDecodeFn

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: spec.md + test.md 작성

**Files:**
- Create: `docs/specs/weighted-index-system/axis-projection.spec.md`
- Create: `docs/specs/weighted-index-system/axis-projection.test.md`
- Modify: `docs/specs/spec.todo.md`

- [ ] **Step 1: axis-projection.spec.md 작성**

```markdown
---
def:
  id: axis-projection
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [optimization, decode, partial]
  links:
    - target: wi-math
      type: refines
---

# Axis Projection — 부분 decode 최적화

## 목적 ^purpose

mixed-radix weighted-index에서 전체 decode O(d) 대신 요청한 k개 차원만 O(k)로 추출한다.

## 수학적 기반 ^defines

i번째 차원 독립 추출 공식:
  coord_i = floor(address / stride[i]) % shape[i] + 1

stride[i] = Π_{j>i} shape[j] (calcWeights로 사전 계산)

## API ^method

### Layer 1: 순수 함수 (calc.ts)
- `partialDecode(address, shape, strides, dimIndices)` → Record<number, number>

### Layer 2: 인스턴스 메서드 (WeightedIndex)
- `extractDims(address, labels)` → Record<string, number>

### Layer 3: catalog runtime (runtime.ts)
- `decodePrefixPartial(catalog, prefixId, version, address, labels)` → Record<string, DecodedPosition>

### Layer 4: Aggregator
- `partialDecodeFn?(key, axes)` 옵션 주입 → projectAxis 내부 최적화

## 성능 ^defines

d=10, k=2: 10 mod/div → 2 div+mod (5배 단축)
```

- [ ] **Step 2: axis-projection.test.md 작성**

```markdown
---
def:
  id: axis-projection-test
  level: leaf
  scope: feature
  aspect: test_scenario
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [testing, optimization]
  links:
    - target: axis-projection
      type: traces_to
---

# Axis Projection — 테스트 시나리오

## 목적 ^purpose

partialDecode의 정확성을 full decode 동치성으로 증명하고, 적용 범위별 동작을 검증한다.

## 검증 항목

### partialDecode (calc.ts) — 7 cases
- 전체 차원 추출 = full decode 동치
- 단일 차원 (첫/마지막)
- 복수 차원 (비연속)
- address 0 경계값
- 빈 dimIndices
- 전수 검증 (소형 shape 전체 주소 공간)

### WeightedIndex.extractDims — 4 cases
- label 기반 부분 추출
- 전체 label = decodeToRecord 동치
- 단일 label
- 미존재 label 에러

### decodePrefixPartial (runtime.ts)
- decodePrefix 부분 결과 동치성

### Aggregator.projectAxis
- partialDecodeFn 주입 시 결과 동일성

## 동치성 증명 구조

∀ address ∈ [0, size), ∀ i ∈ [0, d):
  partialDecode(address, shape, strides, [i])[i] === decode(address)[i]
```

- [ ] **Step 3: spec.todo.md I-6 완료 반영**

`docs/specs/spec.todo.md`의 잔여 작업에서 I-6 행 제거, 완료 현황에 추가.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/weighted-index-system/axis-projection.spec.md docs/specs/weighted-index-system/axis-projection.test.md docs/specs/spec.todo.md
git commit -m "docs: add axis-projection spec.md + test.md, mark I-6 as completed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
