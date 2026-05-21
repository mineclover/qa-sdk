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
    const diags = validate(r.ir, undefined, { skip: ["lifecycle"] });
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("ref-broken error 검출", () => {
    const { yaml, golden } = loadFixture("ref-broken");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir, undefined, { skip: ["lifecycle"] });
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

  describe("validate constraints (확장된 kind)", () => {
    it("capacity kind: entries.length 조건 위반 검출", () => {
      const yaml = `
taxonomy: cap-c
version: 1
axes:
  scope:
    entries: [a, b, c]
constraints:
  - id: scope-max-2
    kind: capacity
    rule: "axes/scope entries.length <= 2"
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "constraint-violated" && d.severity === "error")).toBe(true);
    });

    it("ref kind: 필수 axis 부재 검출", () => {
      const yaml = `
taxonomy: ref-c
version: 1
axes:
  scope:
    entries: [a]
constraints:
  - id: needs-layer
    kind: ref
    rule: "axis=layer must exist"
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "constraint-violated" && d.meta?.missingAxis === "layer")).toBe(true);
    });

    it("custom kind: info-level 진단 emit", () => {
      const yaml = `
taxonomy: custom-c
version: 1
axes:
  scope:
    entries: [a]
constraints:
  - id: my-rule
    kind: custom
    rule: "anything goes here"
    severity: warning
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.severity === "info" && d.meta?.kind === "custom")).toBe(true);
    });
  });

  describe("validate constraints — 구조화 DSL (T-E5)", () => {
    it("capacity kind 구조화 rule — entries.length lte 위반 검출", () => {
      const yaml = `
taxonomy: c1
version: 1
axes:
  scope:
    entries: [a, b, c]
constraints:
  - id: scope-max-2
    kind: capacity
    rule:
      axis: scope
      prop: entries.length
      op: lte
      value: 2
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "constraint-violated" && d.meta?.actual === 3)).toBe(true);
    });

    it("ref kind 구조화 rule — axis 부재 검출", () => {
      const yaml = `
taxonomy: c2
version: 1
axes:
  a:
    entries: [x]
constraints:
  - id: needs-layer
    kind: ref
    rule:
      axis: layer
      mustExist: true
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.meta?.missingAxis === "layer")).toBe(true);
    });

    it("structural kind 구조화 rule — relation에서 forbidden value 검출", () => {
      const yaml = `
taxonomy: c3
version: 1
axes:
  l:
    entries: [a, leaf]
relations:
  r:
    from: l
    to: l
    kind: contains
    rules:
      - { upper: leaf, lower: a }
constraints:
  - id: no-leaf-upper
    kind: structural
    rule:
      relationKind: contains
      forbidden:
        field: upper
        value: leaf
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "constraint-violated" && d.meta?.field === "upper")).toBe(true);
    });

    it("legacy string rule도 작동 + deprecated warning emit", () => {
      const yaml = `
taxonomy: c4
version: 1
axes:
  s:
    entries: [a, b, c]
constraints:
  - id: legacy-cap
    kind: capacity
    rule: "axes/s entries.length <= 2"
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "constraint-deprecated-string-rule")).toBe(true);
      expect(diags.some((d) => d.code === "constraint-violated")).toBe(true);
    });

    it("구조화 rule 형식 오류 — capacity 잘못된 op", () => {
      const yaml = `
taxonomy: c5
version: 1
axes:
  s:
    entries: [a]
constraints:
  - id: bad-cap
    kind: capacity
    rule:
      axis: s
      prop: entries.length
      op: invalidOp
      value: 1
    severity: error
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.message.includes("형식 오류"))).toBe(true);
    });
  });

  describe("validate axis structure", () => {
    it("structural-duplicate-address 검출", () => {
      const { yaml, golden } = loadFixture("duplicate-address");
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error("parse failed");
      const diags = validate(r.ir, undefined, { skip: ["lifecycle"] });
      expect(stripLoc(diags)).toEqual(golden);
    });

    it("structural-duplicate-id 검출", () => {
      const yaml = `
taxonomy: dup-id
version: 1
axes:
  scope:
    entries:
      - { id: a, address: 0 }
      - { id: a, address: 1 }
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error("parse failed");
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "structural-duplicate-id")).toBe(true);
    });
  });

  describe("validate refs (generalized inferAxis)", () => {
    it("depends-on relation에서 명시적 axis-name field 검증", () => {
      const yaml = `
taxonomy: t
version: 1
axes:
  scope:
    entries: [apm, ingest]
relations:
  service-deps:
    from: scope
    to: scope
    kind: depends-on
    rules:
      - { scope: missing }
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      const broken = diags.filter((d) => d.code === "ref-broken");
      expect(broken.length).toBe(1);
      expect(broken[0].meta?.missing).toBe("missing");
    });

    it("binds relation cross-axis field 검증", () => {
      const yaml = `
taxonomy: t
version: 1
axes:
  clip:
    entries: [fade, slide]
  asset:
    entries: [text, image]
relations:
  clip-binds-asset:
    from: clip
    to: asset
    kind: binds
    rules:
      - { clip: fade, asset: nonexistent }
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      const broken = diags.filter((d) => d.code === "ref-broken");
      expect(broken.length).toBe(1);
      expect(broken[0].meta?.axis).toBe("asset");
    });

    it("기존 upper/parent/lower/child 컨벤션 backward compat", () => {
      const yaml = `
taxonomy: t
version: 1
axes:
  depth:
    entries: [a, b]
relations:
  d-contains:
    from: depth
    to: depth
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
      const r = parse(yaml);
      if (!("ir" in r)) throw new Error();
      const diags = validate(r.ir);
      expect(diags.some((d) => d.code === "ref-broken" && d.meta?.field === "lower")).toBe(true);
    });
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
    const diags = validate(derR.ir, reg, { skip: ["lifecycle"] });
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
