import { describe, expect, it } from "vitest";
import { summarizeGraphRetention } from "./graph-retention.js";

describe("graph-retention", () => {
  it("summarizes sweep results", () => {
    expect(
      summarizeGraphRetention({
        keepLatest: 1,
        graphIds: ["g1", "g2"],
        graphCount: 2,
        beforeCount: 4,
        afterCount: 2,
        deletedSnapshotIds: ["s1", "s3"],
        graphs: [],
      }),
    ).toContain("graphs=2");
  });

  it("summarizes single-graph results", () => {
    expect(
      summarizeGraphRetention({
        graphId: "g1",
        beforeCount: 3,
        afterCount: 1,
        deletedSnapshotIds: ["s1", "s2"],
        keptSnapshotIds: ["s3"],
      }),
    ).toContain("graph=g1");
  });
});
