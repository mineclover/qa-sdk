import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { codegen, CodegenValidationError } from "../../src/codegen/index.js";
import { parse } from "../../src/parser/index.js";

const __dirname = join(fileURLToPath(import.meta.url), "..");

const yaml = `
taxonomy: qa
version: 1
axes:
  scope:
    entries: [apm, ingest]
    capacity: 4
  aspect:
    entries: [model, protocol]
    capacity: 4
relations:
  depth-contains:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: apm, lower: ingest }
`;

describe("codegen", () => {
  it("결정론: 같은 IR → 같은 contentHash", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const a = codegen(r.ir, { taxonomyName: "qa" });
    const b = codegen(r.ir, { taxonomyName: "qa" });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.files).toEqual(b.files);
  });

  it("axes.ts에 id union 생성", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["axes.ts"]).toContain('export type ScopeId = "apm" | "ingest"');
  });

  it("addresses.ts에 SCOPE_ADDR 매핑 생성", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["addresses.ts"]).toContain("export const SCOPE_ADDR");
    expect(files["addresses.ts"]).toContain("apm: 0");
    expect(files["addresses.ts"]).toContain("ingest: 1");
  });

  it("meta.ts에 contentHash + generatedAt 박힘", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files, contentHash } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["meta.ts"]).toContain(contentHash);
  });

  it("5개 파일 생성 (axes/addresses/registry/relations/meta)", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(Object.keys(files).sort()).toEqual([
      "addresses.ts",
      "axes.ts",
      "meta.ts",
      "registry.ts",
      "relations.ts",
    ]);
  });

  it("validate errors=0 아닐 때 거부 (spec §7.3)", () => {
    const badYaml = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b]
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const r = parse(badYaml);
    if (!("ir" in r)) throw new Error();
    expect(() => codegen(r.ir)).toThrow(CodegenValidationError);
  });

  it("skipValidate=true 시 broken IR도 codegen", () => {
    const badYaml = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b]
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const r = parse(badYaml);
    if (!("ir" in r)) throw new Error();
    const result = codegen(r.ir, { skipValidate: true });
    expect(result.files).toBeDefined();
  });
});

describe("codegen golden — 결정론 회귀 방지", () => {
  const yamlPath = join(__dirname, "../fixtures/codegen-basic.yaml");
  const goldenDir = join(__dirname, "../fixtures/codegen-basic.golden");

  it("5개 파일이 골든과 char-for-char 일치", () => {
    const yaml = readFileSync(yamlPath, "utf8");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir);
    const fileNames = ["axes.ts", "addresses.ts", "registry.ts", "relations.ts", "meta.ts"];
    for (const name of fileNames) {
      const expected = readFileSync(join(goldenDir, name), "utf8");
      expect(files[name], `${name} mismatch`).toBe(expected);
    }
  });
});
