import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { collectCodeLinkCoverage } from "./code-references.js";

const tempDirs: string[] = [];

describe("collectCodeLinkCoverage", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("explicit code reference가 없는 src 파일을 file-level로 수집한다", () => {
    const root = makeTempRepo();

    writeFileSync(
      join(root, "docs/specs/demo.md"),
      `---
def:
  id: demo-doc
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
source: packages/demo/src/a.ts
---

# Demo

## 목적 ^purpose

demo purpose
`,
      "utf8",
    );

    writeFileSync(join(root, "packages/demo/src/a.ts"), "export const a = 1;\n", "utf8");
    writeFileSync(join(root, "packages/demo/src/b.ts"), `// @def${".doc"} demo-doc\nexport const b = 2;\n`, "utf8");
    writeFileSync(join(root, "packages/demo/src/c.ts"), "export const c = 3;\n", "utf8");
    writeFileSync(join(root, "packages/demo/src/c.test.ts"), "export const cTest = 4;\n", "utf8");

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
      scopes: ["packages/demo/src"],
    });

    expect(coverage.totalFiles).toBe(3);
    expect(coverage.linkedFiles).toBe(2);
    expect(coverage.unlinkedFiles).toBe(1);
    expect(coverage.files).toEqual(["packages/demo/src/c.ts"]);
  });

  it("includeTests=true면 test 파일도 gap 대상으로 포함한다", () => {
    const root = makeTempRepo();

    writeFileSync(
      join(root, "docs/specs/demo.md"),
      `---
def:
  id: demo-doc
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
source: packages/demo/src/a.ts
---

# Demo

## 목적 ^purpose

demo purpose
`,
      "utf8",
    );

    writeFileSync(join(root, "packages/demo/src/a.ts"), "export const a = 1;\n", "utf8");
    writeFileSync(join(root, "packages/demo/src/c.test.ts"), "export const cTest = 4;\n", "utf8");

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
      scopes: ["packages/demo/src"],
      includeTests: true,
    });

    expect(coverage.totalFiles).toBe(2);
    expect(coverage.unlinkedFiles).toBe(1);
    expect(coverage.files).toEqual(["packages/demo/src/c.test.ts"]);
  });
});

function makeTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "qa-code-link-coverage-"));
  tempDirs.push(root);
  mkdirSync(join(root, "docs/specs"), { recursive: true });
  mkdirSync(join(root, "packages/demo/src"), { recursive: true });
  return root;
}
