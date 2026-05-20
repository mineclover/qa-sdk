import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../../src/validate/index.js";
import { parse } from "../../src/parser/index.js";
import { TaxonomyRegistry } from "../../src/registry/index.js";

const FIX = join(__dirname, "../fixtures");

function loadFixture(name: string) {
  const yaml = readFileSync(join(FIX, `${name}.yaml`), "utf8");
  const golden = JSON.parse(readFileSync(join(FIX, `${name}.golden.json`), "utf8"));
  return { yaml, golden };
}

describe("validate", () => {
  it("capacity-headroom warning 검출", () => {
    const { yaml, golden } = loadFixture("capacity-headroom");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("ref-broken error 검출", () => {
    const { yaml, golden } = loadFixture("ref-broken");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("fail-collect — 여러 진단을 한 번에 반환", () => {
    const yaml = `
taxonomy: multi
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const diags = validate(r.ir);
    const codes = diags.map((d) => d.code).sort();
    expect(codes).toContain("capacity-headroom");
    expect(codes).toContain("ref-broken");
  });

  it("constraint level-leaf-no-children 위반 검출", () => {
    const yaml = `
taxonomy: cv
version: 1
axes:
  level:
    entries: [group, module, leaf]
relations:
  bad:
    from: level
    to: level
    kind: contains
    rules:
      - { upper: leaf, lower: group }
constraints:
  - id: level-leaf-no-children
    kind: structural
    rule: "axis=level entry=leaf must not appear as upper in any contains relation"
    severity: error
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    expect(diags.some((d) => d.code === "constraint-violated" && d.severity === "error")).toBe(true);
  });
});

describe("validate cross-taxonomy imports", () => {
  function loadYaml(name: string): string {
    return readFileSync(join(FIX, `${name}.yaml`), "utf8");
  }

  it("import target가 registry에 있으면 errors=0 (imports만 검증)", () => {
    const baseR = parse(loadYaml("cross-tax-base"));
    const derR = parse(loadYaml("cross-tax-import-ok"));
    if (!("ir" in baseR) || !("ir" in derR)) throw new Error();
    const reg = new TaxonomyRegistry();
    reg.add(baseR.ir);
    const diags = validate(derR.ir, reg);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("import target가 registry에 없으면 ref-unresolved-import error", () => {
    const derR = parse(loadYaml("cross-tax-import-broken"));
    if (!("ir" in derR)) throw new Error();
    const reg = new TaxonomyRegistry();  // empty
    const diags = validate(derR.ir, reg);
    const golden = JSON.parse(
      readFileSync(join(FIX, "cross-tax-import-broken.golden.json"), "utf8")
    );
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("registry 없으면 imports 검증 skip (backward compat)", () => {
    const derR = parse(loadYaml("cross-tax-import-broken"));
    if (!("ir" in derR)) throw new Error();
    const diags = validate(derR.ir);  // no registry
    const importDiags = diags.filter((d) => d.code.startsWith("ref-unresolved"));
    expect(importDiags).toEqual([]);
  });

  it("version 불일치 시 ref-version-missing error", () => {
    const baseR = parse(loadYaml("cross-tax-base"));
    if (!("ir" in baseR)) throw new Error();
    const reg = new TaxonomyRegistry();
    reg.add(baseR.ir);  // version 1

    // version 2 요청 yaml
    const v2Yaml = `
taxonomy: needs-v2
version: 1
imports:
  - taxonomy: base-coords
    version: 2
    as: bc
axes:
  scope:
    entries: [a]
`;
    const r = parse(v2Yaml);
    if (!("ir" in r)) throw new Error();
    const diags = validate(r.ir, reg);
    expect(diags.some((d) => d.code === "ref-version-missing")).toBe(true);
  });
});

function stripLoc(diags: unknown[]): unknown[] {
  return diags.map((d) => {
    const { location, ...rest } = d as Record<string, unknown>;
    return rest;
  });
}
