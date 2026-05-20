import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, validate, codegen } from "../src/index.js";

const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const YAML_PATH = join(__dirname, "docs", "taxonomies", "qa-sdk-coordinate-system.yaml");

describe("qa-sdk-coordinate-system 도그푸딩", () => {
  const yamlText = readFileSync(YAML_PATH, "utf8");

  it("parse 성공", () => {
    const r = parse(yamlText);
    expect("ir" in r).toBe(true);
  });

  it("validate errors=0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const a = codegen(r.ir);
    const b = codegen(r.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("SCOPE_ADDR.apm은 결정론적 0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir);
    expect(files["addresses.ts"]).toContain("apm: 0");
  });
});
