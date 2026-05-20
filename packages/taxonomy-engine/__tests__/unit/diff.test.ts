import { describe, it, expect } from "vitest";
import { diff } from "../../src/diff/index.js";
import { parse } from "../../src/parser/index.js";

function parseOrThrow(y: string) {
  const r = parse(y);
  if ("error" in r) throw new Error("parse failed");
  return r.ir;
}

describe("diff", () => {
  it("같은 yaml → same=true", () => {
    const y = `taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: [a, b]\n`;
    expect(diff(parseOrThrow(y), parseOrThrow(y)).same).toBe(true);
  });

  it("entry 추가 검출", () => {
    const a = parseOrThrow(`taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: [a, b]\n`);
    const b = parseOrThrow(`taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: [a, b, c]\n`);
    const r = diff(a, b);
    expect(r.same).toBe(false);
    expect(r.changes.some((c) => c.kind === "entry-added" && (c as any).id === "c")).toBe(true);
  });

  it("entry 제거 + address 변경 검출", () => {
    const a = parseOrThrow(`taxonomy: t\nversion: 1\naxes:\n  s:\n    entries:\n      - { id: a, address: 0 }\n      - { id: b, address: 1 }\n`);
    const b = parseOrThrow(`taxonomy: t\nversion: 1\naxes:\n  s:\n    entries:\n      - { id: a, address: 5 }\n`);
    const r = diff(a, b);
    expect(r.changes.some((c) => c.kind === "entry-removed" && (c as any).id === "b")).toBe(true);
    expect(r.changes.some((c) => c.kind === "entry-address-changed" && (c as any).id === "a")).toBe(true);
  });

  it("axis/relation/constraint 추가 검출", () => {
    const a = parseOrThrow(`taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: [a]\n`);
    const b = parseOrThrow(`
taxonomy: t
version: 1
axes:
  s:
    entries: [a]
  new-axis:
    entries: [x]
relations:
  r:
    from: s
    to: s
    kind: contains
    rules:
      - { upper: a, lower: a }
constraints:
  - id: cap
    kind: capacity
    rule:
      axis: s
      prop: entries.length
      op: gte
      value: 1
    severity: error
`);
    const r = diff(a, b);
    expect(r.changes.some((c) => c.kind === "axis-added" && (c as any).axis === "new-axis")).toBe(true);
    expect(r.changes.some((c) => c.kind === "relation-added" && (c as any).name === "r")).toBe(true);
    expect(r.changes.some((c) => c.kind === "constraint-added" && (c as any).id === "cap")).toBe(true);
  });
});
