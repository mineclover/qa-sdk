# Taxonomy Engine v0.1 — Task 4: Indexer (address ↔ id, packCoordinate)

## 목적 ^purpose

v0.1의 address/id indexer와 coordinate packing 작업 원문을 보존한다.

## Task 4: Indexer (address ↔ id, packCoordinate)

**Files:**
- Create: `packages/taxonomy-engine/src/indexer/index.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/indexer.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/unit/indexer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  indexAxis,
  packCoordinate,
  unpackCoordinate,
} from "../../src/indexer/index.js";
import type { AxisIR } from "../../src/schema/ir.js";

const scope: AxisIR = {
  name: "scope",
  entries: [
    { id: "apm", address: 0 },
    { id: "ingest", address: 1 },
    { id: "registry", address: 2 },
  ],
  capacity: 8,
  version: 1,
};

const aspect: AxisIR = {
  name: "aspect",
  entries: [
    { id: "model", address: 0 },
    { id: "protocol", address: 1 },
  ],
  capacity: 4,
  version: 1,
};

describe("indexAxis", () => {
  it("id ↔ address 양방향 인덱스 구성", () => {
    const idx = indexAxis(scope);
    expect(idx.byId("apm")?.address).toBe(0);
    expect(idx.byAddress(2)?.id).toBe("registry");
  });

  it("모든 entry에 대해 round-trip", () => {
    const idx = indexAxis(scope);
    for (const e of scope.entries) {
      expect(idx.byAddress(idx.byId(e.id)!.address)?.id).toBe(e.id);
    }
  });
});

describe("packCoordinate", () => {
  it("좌표를 packed 정수로 변환", () => {
    const packed = packCoordinate({ scope: "apm", aspect: "model" }, [scope, aspect]);
    expect(typeof packed).toBe("number");
  });

  it("pack ↔ unpack round-trip", () => {
    const coord = { scope: "ingest", aspect: "protocol" };
    const packed = packCoordinate(coord, [scope, aspect]);
    expect(unpackCoordinate(packed, [scope, aspect])).toEqual(coord);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter taxonomy-engine test indexer.test`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/indexer/index.ts`:

```typescript
import type { AxisIR, EntryIR, Coordinate } from "../schema/ir.js";

export type IndexedAxis = {
  axis: AxisIR;
  byId: (id: string) => EntryIR | undefined;
  byAddress: (address: number) => EntryIR | undefined;
};

export function indexAxis(axis: AxisIR): IndexedAxis {
  const byIdMap = new Map<string, EntryIR>();
  const byAddrMap = new Map<number, EntryIR>();
  for (const e of axis.entries) {
    byIdMap.set(e.id, e);
    byAddrMap.set(e.address, e);
  }
  return {
    axis,
    byId: (id) => byIdMap.get(id),
    byAddress: (a) => byAddrMap.get(a),
  };
}

export function packCoordinate(coord: Coordinate, axes: AxisIR[]): number {
  let packed = 0;
  let shift = 0;
  for (const axis of axes) {
    const entry = axis.entries.find((e) => e.id === coord[axis.name]);
    if (!entry) throw new Error(`unknown entry ${coord[axis.name]} in axis ${axis.name}`);
    const bits = Math.ceil(Math.log2(axis.capacity));
    packed |= entry.address << shift;
    shift += bits;
  }
  return packed;
}

export function unpackCoordinate(packed: number, axes: AxisIR[]): Coordinate {
  const coord: Coordinate = {};
  let shift = 0;
  for (const axis of axes) {
    const bits = Math.ceil(Math.log2(axis.capacity));
    const mask = (1 << bits) - 1;
    const address = (packed >> shift) & mask;
    const entry = axis.entries.find((e) => e.address === address);
    if (!entry) throw new Error(`unknown address ${address} in axis ${axis.name}`);
    coord[axis.name] = entry.id;
    shift += bits;
  }
  return coord;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test indexer.test`
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add packages/taxonomy-engine/src/indexer packages/taxonomy-engine/__tests__/unit/indexer.test.ts
git commit -m "feat(taxonomy-engine): indexer with bidirectional id/address + packCoordinate (Task 4)"
```

---
