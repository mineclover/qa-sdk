import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, validate, codegen, doctor } from "../src/index.js";

// 루트 기준 경로 (packages/taxonomy-engine/__tests__에서 4단계 위)
const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const YAML_PATH = join(__dirname, "docs", "taxonomies", "qa-sdk-def-catalog.yaml");
const EXPECTED_PATH = join(
  __dirname,
  "packages",
  "taxonomy-engine",
  "__tests__",
  "fixtures",
  "expected-qa-sdk-def-catalog.json",
);

describe("qa-sdk-def-catalog 도그푸딩 (5번째 사례 — vocabulary 자동 추출)", () => {
  const yamlText = readFileSync(YAML_PATH, "utf8");
  const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));

  it("parse 성공", () => {
    const r = parse(yamlText);
    expect("ir" in r).toBe(true);
    if ("ir" in r) {
      expect(r.ir.taxonomy).toBe("qa-sdk-def-catalog");
    }
  });

  it("validate errors=0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("doctor — vocabulary.ts 자동 추출과 일치", () => {
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

  it("def_level entries 3종 (group/module/leaf) — CLAUDE.md drift 검증", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const level = r.ir.axes.get("def_level");
    const ids = level?.entries.map((e) => e.id) ?? [];
    expect(ids).toEqual(["group", "module", "leaf"]);
  });
});
