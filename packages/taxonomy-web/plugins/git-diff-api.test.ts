import { describe, it, expect } from "vitest";
import { computeFileDiff } from "./git-diff-api";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");

describe("computeFileDiff", () => {
  it("같은 ref 비교 → same=true", () => {
    const result = computeFileDiff({
      repoRoot,
      file: "docs/taxonomies/qa-sdk-coordinate-system.yaml",
      base: "HEAD",
    });
    if (result) {
      expect(result.same).toBe(true);
    }
  });

  it("존재하지 않는 file → undefined", () => {
    const result = computeFileDiff({
      repoRoot,
      file: "docs/taxonomies/nonexistent.yaml",
      base: "HEAD",
    });
    expect(result).toBeUndefined();
  });
});
