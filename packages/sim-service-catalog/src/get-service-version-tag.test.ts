import { describe, it, expect } from "vitest";
import {
  buildServicePrefix,
  parseVersionTag,
} from "sim-identifier-grammar";
import { getServiceVersionTag } from "./get-service-version-tag.js";
import type { CatalogPrefixDefinition } from "./types.js";

const APPROVAL: CatalogPrefixDefinition = {
  prefix: buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" }),
  versionAxis: { kind: "version", capacity: 64 },
  refEntries: [
    { version: "v1", state: "retired" },
    { version: "v2", state: "retired" },
    { version: "v3", state: "stable" },
    { version: "v4-candidate", state: "candidate" },
  ],
};

describe("getServiceVersionTag (spec 02 §5)", () => {
  it("stable → v3, candidate → v4-candidate (parseVersionTag로 회수 가능)", () => {
    expect(parseVersionTag(getServiceVersionTag(APPROVAL, "stable")))
      .toEqual({ axis: "version", value: 3, state: "stable" });
    expect(parseVersionTag(getServiceVersionTag(APPROVAL, "candidate")))
      .toEqual({ axis: "version", value: 4, state: "candidate" });
  });

  it("retired는 다수 가능 → throw (exactly-one invariant)", () => {
    expect(() => getServiceVersionTag(APPROVAL, "retired")).toThrow();
  });

  it("매칭 entry 0개 → throw", () => {
    const noCandidate = {
      ...APPROVAL,
      refEntries: APPROVAL.refEntries.filter((e) => e.state !== "candidate"),
    };
    expect(() => getServiceVersionTag(noCandidate, "candidate")).toThrow();
  });

  it("매칭 entry 2개 이상 → throw (stable 중복)", () => {
    const dupStable = {
      ...APPROVAL,
      refEntries: [
        { version: "v3", state: "stable" as const },
        { version: "v5", state: "stable" as const },
      ],
    };
    expect(() => getServiceVersionTag(dupStable, "stable")).toThrow();
  });
});
