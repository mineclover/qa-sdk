import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../../src/validate/index.js";
import { parse } from "../../src/parser/index.js";

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
});

function stripLoc(diags: unknown[]): unknown[] {
  return diags.map((d) => {
    const { location, ...rest } = d as Record<string, unknown>;
    return rest;
  });
}
