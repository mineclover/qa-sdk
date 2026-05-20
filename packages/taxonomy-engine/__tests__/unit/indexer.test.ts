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
