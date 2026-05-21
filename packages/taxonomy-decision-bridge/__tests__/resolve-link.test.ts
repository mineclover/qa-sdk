import { describe, it, expect } from "vitest";
import { resolveDecisionLink } from "../src/resolve-link.js";

const YAML_DIR = "/repo/docs/taxonomies";
const DECISIONS_DIR = "/repo/docs/decisions";

describe("resolveDecisionLink", () => {
  it("decision:<id> 형식 → stable-id + decisionsDir 기준 해소", () => {
    const r = resolveDecisionLink({
      link: "decision:lesson-builder.layer.cue",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r).toEqual({
      kind: "stable-id",
      id: "lesson-builder.layer.cue",
      absPath: "/repo/docs/decisions/lesson-builder.layer.cue.md",
    });
  });

  it("decision: 식별자 빈 문자열 → unsupported", () => {
    const r = resolveDecisionLink({
      link: "decision:",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r.kind).toBe("unsupported");
    if (r.kind === "unsupported") {
      expect(r.reason).toMatch(/비어있음/);
    }
  });

  it("decision: 식별자 형식 오류 (공백/슬래시) → unsupported", () => {
    for (const bad of ["decision:foo bar", "decision:foo/bar", "decision:has$char"]) {
      const r = resolveDecisionLink({
        link: bad,
        yamlAbsDir: YAML_DIR,
        decisionsDir: DECISIONS_DIR,
      });
      expect(r.kind, `${bad}`).toBe("unsupported");
    }
  });

  it("relative path → path + yaml 디렉토리 기준 해소", () => {
    const r = resolveDecisionLink({
      link: "../decisions/test.layer.cue.md",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r).toEqual({
      kind: "path",
      absPath: "/repo/docs/decisions/test.layer.cue.md",
    });
  });

  it("absolute path → path 그대로", () => {
    const r = resolveDecisionLink({
      link: "/abs/decision.md",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r).toEqual({ kind: "path", absPath: "/abs/decision.md" });
  });

  it("http:// → external", () => {
    const r = resolveDecisionLink({
      link: "http://example.com/dec",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r.kind).toBe("external");
  });

  it("https:// → external", () => {
    const r = resolveDecisionLink({
      link: "https://example.com/dec",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r.kind).toBe("external");
  });

  it("decision-flow:// → unsupported", () => {
    const r = resolveDecisionLink({
      link: "decision-flow://node-id",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r.kind).toBe("unsupported");
    if (r.kind === "unsupported") {
      expect(r.reason).toMatch(/decision-flow/);
    }
  });

  it("tax: ref → unsupported", () => {
    const r = resolveDecisionLink({
      link: "tax:slug:axis.entry",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r.kind).toBe("unsupported");
  });

  it("backward-compat: 기존 path 형식이 여전히 작동", () => {
    const r = resolveDecisionLink({
      link: "./local.md",
      yamlAbsDir: YAML_DIR,
      decisionsDir: DECISIONS_DIR,
    });
    expect(r).toEqual({
      kind: "path",
      absPath: "/repo/docs/taxonomies/local.md",
    });
  });
});
