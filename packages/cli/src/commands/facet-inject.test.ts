import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { injectFacetExports } from "./facet-inject.js";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TMP = join(tmpdir(), `facet-inject-test-${Date.now()}`);

describe("injectFacetExports", () => {
  beforeEach(() => mkdirSync(join(TMP, "src"), { recursive: true }));
  afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

  it("@facet export 목록의 함수에 export 추가", () => {
    writeFileSync(join(TMP, "src/calc.ts"), [
      "// @facet export add, multiply",
      "function add(a: number, b: number) { return a + b; }",
      "function multiply(a: number, b: number) { return a * b; }",
      "function internal() { return 0; }",
    ].join("\n"));

    const count = injectFacetExports(TMP);
    const content = readFileSync(join(TMP, "src/calc.ts"), "utf-8");

    expect(content).toContain("export function add(");
    expect(content).toContain("export function multiply(");
    expect(content).not.toContain("export function internal(");
    expect(count).toBe(2);
  });

  it("이미 export된 함수는 건너뜀", () => {
    writeFileSync(join(TMP, "src/already.ts"), [
      "// @facet export validate",
      "export function validate() { return true; }",
    ].join("\n"));

    const count = injectFacetExports(TMP);
    expect(count).toBe(0);
  });

  it("@facet export 없는 파일은 무시", () => {
    writeFileSync(join(TMP, "src/pure.ts"), "// @facet\nexport function ok() {}\n");
    const count = injectFacetExports(TMP);
    expect(count).toBe(0);
  });
});
