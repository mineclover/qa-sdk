// @def.doc definition-catalog-spec

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { collectCodeLinkCoverage, DEFAULT_EXCLUDE_PACKAGES } from "./code-references.js";

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

  it("excludePackages 에 명시된 패키지 파일은 분모/분자 모두에서 제외한다", () => {
    const root = makeTempRepo();
    mkdirSync(join(root, "packages/bench/src"), { recursive: true });
    mkdirSync(join(root, "packages/simulation-tests/src"), { recursive: true });

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
    writeFileSync(join(root, "packages/demo/src/b.ts"), "export const b = 2;\n", "utf8");
    // 아래 두 파일은 infra 패키지에 속하므로 excludePackages 기본값으로 제외되어야 한다.
    writeFileSync(join(root, "packages/bench/src/harness.ts"), "export const h = 1;\n", "utf8");
    writeFileSync(join(root, "packages/simulation-tests/src/scenario.ts"), "export const s = 1;\n", "utf8");

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
    });

    // raw 는 4 개 전부 분모에 포함 (demo/a,b + bench + simulation-tests)
    expect(coverage.raw.total).toBe(4);
    expect(coverage.raw.linked).toBe(1);
    // adjusted 는 bench + simulation-tests 2 개 제외 → demo 2 개만 남음
    expect(coverage.adjusted.total).toBe(2);
    expect(coverage.adjusted.linked).toBe(1);
    expect(coverage.adjusted.excluded).toBe(2);
    expect(coverage.totalFiles).toBe(coverage.adjusted.total);
    expect(coverage.files).toEqual(["packages/demo/src/b.ts"]);
    expect(coverage.excludedPackages).toEqual(DEFAULT_EXCLUDE_PACKAGES);
  });

  it("synced/ 와 __mocks__/ 디렉터리는 IGNORED_DIRS 에 따라 walker 단계에서 제외한다", () => {
    const root = makeTempRepo();
    mkdirSync(join(root, "packages/demo/src/synced/gate-service"), { recursive: true });
    mkdirSync(join(root, "packages/demo/src/__mocks__"), { recursive: true });

    writeFileSync(join(root, "packages/demo/src/a.ts"), "export const a = 1;\n", "utf8");
    writeFileSync(
      join(root, "packages/demo/src/synced/gate-service/mirror.ts"),
      "export const m = 1;\n",
      "utf8",
    );
    writeFileSync(
      join(root, "packages/demo/src/__mocks__/env.ts"),
      "export const env = {};\n",
      "utf8",
    );

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
      scopes: ["packages/demo/src"],
    });

    // synced/ 와 __mocks__/ 하위 파일은 walker 가 아예 진입하지 않으므로 raw 분모에도 빠진다.
    expect(coverage.raw.total).toBe(1);
    expect(coverage.adjusted.total).toBe(1);
    expect(coverage.files).toEqual(["packages/demo/src/a.ts"]);
  });

  it("excludePackages: [] 로 명시적으로 덮으면 default 제외가 비활성화된다", () => {
    const root = makeTempRepo();
    mkdirSync(join(root, "packages/bench/src"), { recursive: true });

    writeFileSync(join(root, "packages/demo/src/a.ts"), "export const a = 1;\n", "utf8");
    writeFileSync(join(root, "packages/bench/src/runner.ts"), "export const r = 1;\n", "utf8");

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
      excludePackages: [],
    });

    // default 를 끈 상태 → bench 파일도 분모/분자에 포함
    expect(coverage.raw.total).toBe(2);
    expect(coverage.adjusted.total).toBe(2);
    expect(coverage.adjusted.excluded).toBe(0);
    expect(coverage.excludedPackages).toEqual([]);
  });

  it("옵션 미지정시 DEFAULT_EXCLUDE_PACKAGES 가 그대로 적용된다", () => {
    const root = makeTempRepo();

    writeFileSync(join(root, "packages/demo/src/a.ts"), "export const a = 1;\n", "utf8");

    const coverage = collectCodeLinkCoverage(root, {
      docsDir: "docs",
      codeDirs: ["packages"],
    });

    expect(coverage.excludedPackages).toEqual(DEFAULT_EXCLUDE_PACKAGES);
    // DEFAULT_EXCLUDE_PACKAGES 는 audit 에서 식별한 4 개 패키지를 모두 포함해야 한다.
    expect(DEFAULT_EXCLUDE_PACKAGES).toEqual(
      expect.arrayContaining(["simulation-tests", "facet-tests", "viteplus-sdk-smoke", "bench"]),
    );
    // raw 와 adjusted 양쪽 모두 구조화되어 있어야 한다 (linked 없음 → 0).
    expect(coverage.raw).toMatchObject({ linked: 0, total: 1, percentage: 0 });
    expect(coverage.adjusted).toMatchObject({ linked: 0, total: 1, percentage: 0, excluded: 0 });
  });
});

function makeTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "qa-code-link-coverage-"));
  tempDirs.push(root);
  mkdirSync(join(root, "docs/specs"), { recursive: true });
  mkdirSync(join(root, "packages/demo/src"), { recursive: true });
  return root;
}
