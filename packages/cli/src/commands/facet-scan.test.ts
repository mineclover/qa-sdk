import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseFacetMarker, scanFacetFiles, resolveImportDeps, generateIncludeList } from "./facet-scan.js";
import type { FacetFile, DepFile } from "./facet-scan.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TMP = join(tmpdir(), `facet-scan-test-${Date.now()}`);

describe("parseFacetMarker", () => {
  it("@facet 마커 → 파일 수준 선언", () => {
    expect(parseFacetMarker("// @facet")).toEqual({ type: "file", exports: [] });
  });

  it("@facet export fn1, fn2 → export 목록", () => {
    expect(parseFacetMarker("// @facet export validateOrder, calcDiscount")).toEqual({
      type: "file",
      exports: ["validateOrder", "calcDiscount"],
    });
  });

  it("@facet 없는 줄 → null", () => {
    expect(parseFacetMarker("// normal comment")).toBeNull();
    expect(parseFacetMarker("const x = 1;")).toBeNull();
  });

  it("# 주석 (Python) 지원", () => {
    expect(parseFacetMarker("# @facet")).toEqual({ type: "file", exports: [] });
  });

  it("JSDoc 스타일 * 주석 지원", () => {
    expect(parseFacetMarker(" * @facet export foo")).toEqual({ type: "file", exports: ["foo"] });
  });
});

describe("scanFacetFiles", () => {
  beforeEach(() => mkdirSync(join(TMP, "src"), { recursive: true }));
  afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

  it("@facet 마커가 있는 파일만 수집", () => {
    writeFileSync(join(TMP, "src/pure.ts"), "// @facet\nexport function add(a: number, b: number) { return a + b; }\n");
    writeFileSync(join(TMP, "src/env.ts"), "export const env = process.env;\n");
    writeFileSync(join(TMP, "src/also-pure.ts"), "// @facet export calc\nfunction calc() { return 1; }\n");

    const result = scanFacetFiles(TMP);
    expect(result.facetFiles.map(f => f.relativePath).sort()).toEqual(["src/also-pure.ts", "src/pure.ts"]);
    expect(result.facetFiles.find(f => f.relativePath === "src/also-pure.ts")!.marker.exports).toEqual(["calc"]);
  });

  it("node_modules, dist, test 파일은 제외", () => {
    mkdirSync(join(TMP, "node_modules/pkg"), { recursive: true });
    mkdirSync(join(TMP, "dist"), { recursive: true });
    writeFileSync(join(TMP, "node_modules/pkg/index.ts"), "// @facet\n");
    writeFileSync(join(TMP, "dist/out.ts"), "// @facet\n");
    writeFileSync(join(TMP, "src/foo.test.ts"), "// @facet\n");

    const result = scanFacetFiles(TMP);
    expect(result.facetFiles).toHaveLength(0);
  });
});

describe("resolveImportDeps", () => {
  beforeEach(() => {
    mkdirSync(join(TMP, "src/types"), { recursive: true });
    mkdirSync(join(TMP, "src/config"), { recursive: true });
    mkdirSync(join(TMP, "src/lib"), { recursive: true });
  });
  afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

  it("import 체인을 따라 순수 의존만 수집", () => {
    writeFileSync(join(TMP, "src/gate.ts"), '// @facet\nimport { Order } from "./types/order.js";\nexport function validate(o: any) { return true; }\n');
    writeFileSync(join(TMP, "src/types/order.ts"), 'export interface Order { id: string; }\n');

    const result = resolveImportDeps(join(TMP, "src/gate.ts"), TMP);
    expect(result.included.map(f => f.relativePath)).toContain("src/types/order.ts");
    expect(result.blocked).toHaveLength(0);
  });

  it("환경 의존 import → block", () => {
    writeFileSync(join(TMP, "src/handler.ts"), '// @facet\nimport { env } from "./config/env.js";\n');
    writeFileSync(join(TMP, "src/config/env.ts"), 'export const env = { PORT: Number(process.env.PORT) };\n');

    const result = resolveImportDeps(join(TMP, "src/handler.ts"), TMP);
    expect(result.blocked.map(b => b.relativePath)).toContain("src/config/env.ts");
    expect(result.blocked[0].reason).toContain("process.env");
  });

  it("import type은 block하지 않음", () => {
    writeFileSync(join(TMP, "src/service.ts"), '// @facet\nimport type { Logger } from "./lib/logger.js";\n');
    writeFileSync(join(TMP, "src/lib/logger.ts"), 'import { createLogger } from "pino";\nexport type Logger = ReturnType<typeof createLogger>;\n');

    const result = resolveImportDeps(join(TMP, "src/service.ts"), TMP);
    expect(result.blocked).toHaveLength(0);
  });
});

describe("generateIncludeList", () => {
  it("rclone include-list 형식 생성", () => {
    const files: FacetFile[] = [
      { relativePath: "src/gate.ts", absolutePath: "/x/src/gate.ts", marker: { type: "file", exports: [] } },
    ];
    const deps: DepFile[] = [
      { relativePath: "src/types/order.ts", absolutePath: "/x/src/types/order.ts" },
    ];
    const list = generateIncludeList(files, deps);
    expect(list).toContain("+ src/gate.ts");
    expect(list).toContain("+ src/types/order.ts");
    expect(list).toContain("- **");
  });
});
