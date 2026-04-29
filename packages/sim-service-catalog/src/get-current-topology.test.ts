import { describe, it, expect } from "vitest";
import { buildServicePrefix } from "sim-identifier-grammar";
import { getCurrentTopology } from "./get-current-topology.js";
import type { CatalogPrefixDefinition } from "./types.js";

const PREFIX = buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" });

function makeCat(refEntries: { version: string; state: "retired" | "stable" | "candidate" }[]): CatalogPrefixDefinition {
  return { prefix: PREFIX, versionAxis: { kind: "version", capacity: 64 }, refEntries };
}

describe("getCurrentTopology (spec 02 §5)", () => {
  it("stable + candidate + 다수 retired → 모든 슬롯 분류 + revision 보존", () => {
    const t = getCurrentTopology(
      makeCat([
        { version: "v1", state: "retired" },
        { version: "v2", state: "retired" },
        { version: "v3", state: "stable" },
        { version: "v4-candidate", state: "candidate" },
      ]),
      { revision: 7 },
    );
    expect(t.stable).toEqual({ axis: "version", value: 3, state: "stable" });
    expect(t.candidate).toEqual({ axis: "version", value: 4, state: "candidate" });
    expect(t.retired.map((r) => r.value)).toEqual([1, 2]);
    expect(t.revision).toBe(7);
    expect(t.prefix).toEqual({ namespace: "sim", category: "svc", name: "approval" });
  });

  it("candidate 없음 → null, retired 0개 OK", () => {
    const t = getCurrentTopology(makeCat([{ version: "v1", state: "stable" }]), { revision: 0 });
    expect(t.candidate).toBeNull();
    expect(t.retired).toEqual([]);
    expect(t.stable.value).toBe(1);
  });

  it("invariant 위반 케이스 모두 throw", () => {
    expect(() => getCurrentTopology(makeCat([{ version: "v1", state: "retired" }]), { revision: 0 }))
      .toThrow(/stable/); // stable 0개
    expect(() => getCurrentTopology(makeCat([
      { version: "v3", state: "stable" },
      { version: "v5", state: "stable" },
    ]), { revision: 0 })).toThrow(/stable/); // stable 2개
    expect(() => getCurrentTopology(makeCat([
      { version: "v3", state: "stable" },
      { version: "v4-candidate", state: "candidate" },
      { version: "v5-candidate", state: "candidate" },
    ]), { revision: 0 })).toThrow(/candidate/); // candidate 2개
  });
});
