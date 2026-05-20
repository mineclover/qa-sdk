import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parse,
  validate,
  codegen,
  doctor,
  TaxonomyRegistry,
} from "../src/index.js";

// 루트 기준 경로 (packages/taxonomy-engine/__tests__에서 4단계 위)
const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const BASE_PATH = join(__dirname, "docs", "taxonomies", "qa-sdk-coordinate-system.yaml");
const INGEST_PATH = join(__dirname, "docs", "taxonomies", "ingest-coords.yaml");
const EXPECTED_PATH = join(
  __dirname,
  "packages",
  "taxonomy-engine",
  "__tests__",
  "fixtures",
  "expected-ingest-coords.json"
);

describe("ingest-coords 도그푸딩 (4번째 외부 사례)", () => {
  const baseYaml = readFileSync(BASE_PATH, "utf8");
  const ingestYaml = readFileSync(INGEST_PATH, "utf8");
  const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));

  function buildRegistry(): TaxonomyRegistry {
    const reg = new TaxonomyRegistry();
    const base = parse(baseYaml);
    const ingest = parse(ingestYaml);
    if (!("ir" in base) || !("ir" in ingest)) throw new Error("parse failed");
    reg.add(base.ir);
    reg.add(ingest.ir);
    return reg;
  }

  it("parse 성공", () => {
    const r = parse(ingestYaml);
    expect("ir" in r).toBe(true);
    if ("ir" in r) {
      expect(r.ir.taxonomy).toBe("ingest-coords");
      expect(r.ir.imports.length).toBe(1);
      expect(r.ir.imports[0].taxonomy).toBe("qa-sdk-coordinate-system");
    }
  });

  it("validate errors=0 (registry 등록 후, cross-tax import 해소)", () => {
    const reg = buildRegistry();
    const ingest = reg.get("ingest-coords")!;
    const diags = validate(ingest, reg);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("doctor — store-driver 4종, insights-driver 2종, store-kind 9종, store-coverage 3종 fixture와 일치", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = doctor(r.ir, expected);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const a = codegen(r.ir);
    const b = codegen(r.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("memory store driver가 모든 store-kind 지원 (9/9 full coverage)", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const rel = r.ir.relations.get("store-supports-kind");
    expect(rel).toBeDefined();
    const memorySupports = rel!.rules
      .filter((rule) => rule["store-driver"] === "memory")
      .map((rule) => rule["store-kind"]);
    const allStoreKinds = r.ir.axes.get("store-kind")!.entries.map((e) => e.id);
    expect(memorySupports.sort()).toEqual(allStoreKinds.sort());
  });

  it("clickhouse는 record 1종만 native (OLAP 전용)", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const rel = r.ir.relations.get("store-supports-kind");
    expect(rel).toBeDefined();
    const chSupports = rel!.rules
      .filter((rule) => rule["store-driver"] === "clickhouse")
      .map((rule) => rule["store-kind"]);
    expect(chSupports).toEqual(["record"]);
  });

  it("d1은 record/trace/session/verdict 4종 native (partial coverage)", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const rel = r.ir.relations.get("store-supports-kind");
    expect(rel).toBeDefined();
    const d1Supports = rel!.rules
      .filter((rule) => rule["store-driver"] === "d1")
      .map((rule) => rule["store-kind"])
      .sort();
    expect(d1Supports).toEqual(["record", "session", "trace", "verdict"].sort());
  });

  it("driver-coverage relation — memory/pg=full, d1=partial, clickhouse=single", () => {
    const r = parse(ingestYaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const coverageRel = r.ir.relations.get("driver-coverage");
    expect(coverageRel).toBeDefined();
    const coverageMap = Object.fromEntries(
      coverageRel!.rules.map((rule) => [rule["store-driver"], rule["store-coverage"]])
    );
    expect(coverageMap["memory"]).toBe("full");
    expect(coverageMap["pg"]).toBe("full");
    expect(coverageMap["d1"]).toBe("partial");
    expect(coverageMap["clickhouse"]).toBe("single");
  });
});
