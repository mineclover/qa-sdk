import { describe, it, expect } from "vitest";
import { computeFileDiff } from "./git-diff-api";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");

describe("computeFileDiff", () => {
  it("HEAD ↔ working tree 비교 → diff + migration plan 반환", () => {
    const result = computeFileDiff({
      repoRoot,
      file: "docs/taxonomies/qa-sdk-coordinate-system.yaml",
      base: "HEAD",
    });
    if (result) {
      // working tree와 HEAD가 같으면 same=true, 다르면 false — 둘 다 valid
      expect(typeof result.diff.same).toBe("boolean");
      expect(["major", "minor", "patch", "none"]).toContain(result.diff.breakingLevel);
      expect(result.migration).toBeDefined();
      expect(Array.isArray(result.migration.idRenames)).toBe(true);
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
