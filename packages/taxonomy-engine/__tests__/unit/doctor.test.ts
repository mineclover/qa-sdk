import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "../../src/doctor/index.js";
import { parse } from "../../src/parser/index.js";

const FIX = join(__dirname, "../fixtures");
const YAML_PATH = join(__dirname, "../../../../docs/taxonomies/qa-sdk-coordinate-system.yaml");

describe("doctor", () => {
  const expected = JSON.parse(
    readFileSync(join(FIX, "expected-qa-sdk-coords.json"), "utf8")
  );

  it("qa-sdk-coordinate-system.yaml과 expected SSOT가 일치 (drift 없음)", () => {
    const yaml = readFileSync(YAML_PATH, "utf8");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const diags = doctor(r.ir, expected);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("expected에 있는데 yaml에 없는 axis 시 doctor-missing error", () => {
    const driftedExpected = {
      taxonomy: "qa-sdk-coordinate-system",
      axes: {
        scope: { entries: [{ id: "apm", address: 0 }] },
        missing_axis: { entries: [{ id: "entry1" }] },
      },
    };
    const yaml = readFileSync(YAML_PATH, "utf8");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const diags = doctor(r.ir, driftedExpected);
    const missing = diags.filter((d) => d.code === "doctor-missing" && d.meta?.axis === "missing_axis");
    expect(missing.length).toBe(1);
  });

  it("address 불일치 시 doctor-drift warning", () => {
    const yaml = `taxonomy: t
version: 1
axes:
  s:
    entries:
      - { id: a, address: 5 }
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const exp = { taxonomy: "t", axes: { s: { entries: [{ id: "a", address: 0 }] } } };
    const diags = doctor(r.ir, exp);
    const drift = diags.filter((d) => d.code === "doctor-drift" && d.meta?.field === "address");
    expect(drift.length).toBe(1);
    expect(drift[0].meta?.yaml).toBe(5);
    expect(drift[0].meta?.expected).toBe(0);
  });

  it("expected entry 누락 시 doctor-missing error", () => {
    const yaml = `taxonomy: t
version: 1
axes:
  s:
    entries: [a]
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const exp = { taxonomy: "t", axes: { s: { entries: [{ id: "missing" }] } } };
    const diags = doctor(r.ir, exp);
    const missing = diags.filter((d) => d.code === "doctor-missing" && d.meta?.missing === "missing");
    expect(missing.length).toBe(1);
  });

  it("yaml entry이 expected에 없으면 doctor-unexpected warning", () => {
    const yaml = `taxonomy: t
version: 1
axes:
  s:
    entries: [a, b]
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const exp = { taxonomy: "t", axes: { s: { entries: [{ id: "a" }] } } };
    const diags = doctor(r.ir, exp);
    const unexpected = diags.filter((d) => d.code === "doctor-unexpected" && d.meta?.unexpected === "b");
    expect(unexpected.length).toBe(1);
  });

  it("label 불일치 시 doctor-drift warning", () => {
    const yaml = `taxonomy: t
version: 1
axes:
  s:
    entries:
      - { id: a, label: "wrong label" }
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const exp = { taxonomy: "t", axes: { s: { entries: [{ id: "a", label: "correct label" }] } } };
    const diags = doctor(r.ir, exp);
    const drift = diags.filter((d) => d.code === "doctor-drift" && d.meta?.field === "label");
    expect(drift.length).toBe(1);
    expect(drift[0].meta?.yaml).toBe("wrong label");
    expect(drift[0].meta?.expected).toBe("correct label");
  });

  it("여러 axis 검사 가능", () => {
    const yaml = `taxonomy: t
version: 1
axes:
  ax1:
    entries: [a, b]
  ax2:
    entries: [x]
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error(`Parse failed: ${r.error?.message}`);
    const exp = {
      taxonomy: "t",
      axes: {
        ax1: { entries: [{ id: "a" }, { id: "b" }] },
        ax2: { entries: [{ id: "x" }, { id: "y" }] },
      },
    };
    const diags = doctor(r.ir, exp);
    const missing = diags.filter((d) => d.code === "doctor-missing");
    expect(missing.length).toBe(1);
    expect(missing[0].meta?.missing).toBe("y");
  });
});
