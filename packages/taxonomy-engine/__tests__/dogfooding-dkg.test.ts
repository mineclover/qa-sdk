import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parse,
  validate,
  codegen,
  doctor,
  walkRelation,
  slice,
} from "../src/index.js";

// 루트 기준 경로 (packages/taxonomy-engine/__tests__에서 4단계 위)
const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const YAML_PATH = join(__dirname, "docs", "taxonomies", "dkg-schema.yaml");
const EXPECTED_PATH = join(
  __dirname,
  "packages",
  "taxonomy-engine",
  "__tests__",
  "fixtures",
  "expected-dkg-schema.json"
);

describe("dkg-schema 도그푸딩 (PoC — 두 번째 외부 사례)", () => {
  const yamlText = readFileSync(YAML_PATH, "utf8");
  const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));

  it("parse 성공", () => {
    const r = parse(yamlText);
    expect("ir" in r).toBe(true);
    if ("ir" in r) {
      expect(r.ir.taxonomy).toBe("dkg-schema");
    }
  });

  it("validate errors=0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("node-kind 16 entries 모두 포함 (SSOT 일치)", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const nodeKind = r.ir.axes.get("node-kind");
    expect(nodeKind?.entries.length).toBe(16);
  });

  it("edge-kind 18 entries 모두 포함", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const edgeKind = r.ir.axes.get("edge-kind");
    expect(edgeKind?.entries.length).toBe(18);
  });

  it("doctor — SSOT fixture와 drift 없음", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = doctor(r.ir, expected);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const a = codegen(r.ir);
    const b = codegen(r.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("walkRelation node-tier-membership: catalog-derived tier에 axis/prefix/spec/schema 4종 매핑", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const visited = [...walkRelation(r.ir, "node-tier-membership", "catalog-derived")];
    expect(visited).toContain("axis");
    expect(visited).toContain("prefix");
    expect(visited).toContain("spec");
    expect(visited).toContain("schema");
  });

  it("slice — design-ops tier의 4 노드 추출 가능", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    // node-tier-membership relation에서 design-ops에 속하는 node-kind 목록 파생
    const tierMembership = r.ir.relations.get("node-tier-membership");
    expect(tierMembership).toBeDefined();
    const designOpsNodes = tierMembership!.rules
      .filter((rule) => rule["node-tier"] === "design-ops")
      .map((rule) => rule["node-kind"]);
    expect(designOpsNodes).toEqual([
      "decision",
      "version-event",
      "constraint",
      "observation",
    ]);
  });
});
