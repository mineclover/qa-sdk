import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parse,
  validate,
  codegen,
  TaxonomyRegistry,
  show,
  slice,
  walkRelation,
} from "../src/index.js";

const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const BASE_PATH = join(__dirname, "docs", "taxonomies", "qa-sdk-coordinate-system.yaml");
const LB_PATH = join(__dirname, "docs", "taxonomies", "lesson-builder-content.yaml");

describe("lesson-builder-content 도그푸딩 (메타 시스템 첫 외부 사례)", () => {
  const baseYaml = readFileSync(BASE_PATH, "utf8");
  const lbYaml = readFileSync(LB_PATH, "utf8");

  function buildRegistry(): TaxonomyRegistry {
    const reg = new TaxonomyRegistry();
    const base = parse(baseYaml);
    const lb = parse(lbYaml);
    if (!("ir" in base) || !("ir" in lb)) throw new Error("parse failed");
    reg.add(base.ir);
    reg.add(lb.ir);
    return reg;
  }

  it("parse 성공", () => {
    const r = parse(lbYaml);
    expect("ir" in r).toBe(true);
    if ("ir" in r) {
      expect(r.ir.taxonomy).toBe("lesson-builder-content");
      expect(r.ir.imports.length).toBe(1);
      expect(r.ir.imports[0].taxonomy).toBe("qa-sdk-coordinate-system");
    }
  });

  it("validate errors=0 (registry 등록 후, cross-tax import 해소)", () => {
    const reg = buildRegistry();
    const lb = reg.get("lesson-builder-content")!;
    const diags = validate(lb, reg);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("registry에 base 없으면 ref-unresolved-import error", () => {
    const reg = new TaxonomyRegistry();
    const lb = parse(lbYaml);
    if (!("ir" in lb)) throw new Error();
    reg.add(lb.ir);
    const diags = validate(lb.ir, reg);
    const importErr = diags.filter((d) => d.code === "ref-unresolved-import");
    expect(importErr.length).toBe(1);
    expect(importErr[0].meta?.missing).toBe("qa-sdk-coordinate-system");
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const lb = parse(lbYaml);
    if (!("ir" in lb)) throw new Error();
    const a = codegen(lb.ir);
    const b = codegen(lb.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("axes.ts에 7개 layer entries 모두 포함", () => {
    const lb = parse(lbYaml);
    if (!("ir" in lb)) throw new Error();
    const { files } = codegen(lb.ir);
    expect(files["axes.ts"]).toContain('"type-schema"');
    expect(files["axes.ts"]).toContain('"asset"');
    expect(files["axes.ts"]).toContain('"clip"');
    expect(files["axes.ts"]).toContain('"cue"');
    expect(files["axes.ts"]).toContain('"stage"');
    expect(files["axes.ts"]).toContain('"branch"');
    expect(files["axes.ts"]).toContain('"scenario"');
  });

  it("show — clip-template:appear-fade 단위 조회", () => {
    const reg = buildRegistry();
    const r = show("lesson-builder-content:clip-template.appear-fade", reg);
    expect(r?.kind).toBe("entry");
    if (r?.kind === "entry") {
      expect((r.entry as { id: string }).id).toBe("appear-fade");
    }
  });

  it("slice — asset-type 전체 6개 추출", () => {
    const reg = buildRegistry();
    const lb = reg.get("lesson-builder-content")!;
    const types = slice(lb, "asset-type");
    expect(types.length).toBe(6);
    expect(types.map((e) => e.id).sort()).toEqual(
      ["background", "bubble", "character", "decoration", "quiz", "text"]
    );
  });

  it("walkRelation — layer-contains: scenario에서 출발해 모든 하위 도달", () => {
    const reg = buildRegistry();
    const lb = reg.get("lesson-builder-content")!;
    const visited = [...walkRelation(lb, "layer-contains", "scenario")];
    // scenario → stage, branch → cue → asset, clip
    expect(visited).toContain("scenario");
    expect(visited).toContain("stage");
    expect(visited).toContain("branch");
    expect(visited).toContain("cue");
    expect(visited).toContain("asset");
    expect(visited).toContain("clip");
  });

  it("clip-binds-asset-control 모든 rule이 param-kind=control (constraint 의도)", () => {
    const lb = parse(lbYaml);
    if (!("ir" in lb)) throw new Error();
    const rel = lb.ir.relations.get("clip-binds-asset-control")!;
    for (const rule of rel.rules) {
      expect(rule.to).toBe("control");
    }
  });
});
