import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";
import { diff } from "../../src/diff/index.js";

function ir(yaml: string) {
  const r = parse(yaml);
  if (!("ir" in r)) throw new Error("parse failed");
  return r.ir;
}

describe("diff lifecycle", () => {
  it("entry lifecycle 변경 감지", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd }]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
    const changes = diff(a, b).changes.filter(
      (c) => c.kind === "entry-lifecycle-changed",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "entry-lifecycle-changed",
      axis: "a",
      id: "x",
      from: "tbd",
      to: "approved",
    });
  });

  it("entry lifecycle 신규 부여 (undefined → approved)", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
    const changes = diff(a, b).changes.filter(
      (c) => c.kind === "entry-lifecycle-changed",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ from: undefined, to: "approved" });
  });

  it("placeholderReason 변경 감지", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd, placeholderReason: "이유 A" }]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd, placeholderReason: "이유 B" }]`);
    const changes = diff(a, b).changes.filter(
      (c) => c.kind === "entry-placeholder-reason-changed",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ from: "이유 A", to: "이유 B" });
  });

  it("decisionLink 변경 감지", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "./a.md" }]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "./b.md" }]`);
    const changes = diff(a, b).changes.filter(
      (c) => c.kind === "entry-decision-link-changed",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ from: "./a.md", to: "./b.md" });
  });

  it("axis lifecycle 변경 감지", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: draft
    entries: [x]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [x]`);
    const changes = diff(a, b).changes.filter(
      (c) => c.kind === "axis-lifecycle-changed",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ from: "draft", to: "approved" });
  });

  it("lifecycle 변경 없음 → diff 없음", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
    expect(diff(a, a).changes.filter((c) => c.kind.startsWith("entry-lifecycle"))).toEqual([]);
  });
});
