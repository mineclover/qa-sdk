// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadSpecs, parseSpecFile } from "./spec-loader.js";

const TEST_DIR = join(import.meta.dirname, "__test_specs__");

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });

  // SpecDocument (JSON)
  await writeFile(
    join(TEST_DIR, "feat-003.json"),
    JSON.stringify({
      id: "FEAT-003",
      type: "feat",
      title: "서비스별 역할 권한 분리",
      lifecycle: "active",
      rationale: "서비스마다 독립적인 권한 관리 필요",
      relations: [
        { from: "FEAT-003", to: "REQ-001", type: "satisfies" },
      ],
    }),
  );

  // PrefixSpec (JSON)
  await writeFile(
    join(TEST_DIR, "permission.prefix.json"),
    JSON.stringify({
      id: "permission",
      version: "v1",
      dims: {
        perm_svc: { kind: "prefix_ref", prefixId: "service" },
        role: { kind: "axis", axisId: "role" },
      },
      export: {
        dims: ["perm_svc", "role"],
        pattern: "{perm_svc}.{role}",
      },
      imports: { perm_svc: "service" },
      rationale: "서비스별 역할 권한 분리",
    }),
  );

  // Invalid spec (JSON)
  await writeFile(
    join(TEST_DIR, "invalid.json"),
    JSON.stringify({ random: "data" }),
  );

  // Simple YAML SpecDocument
  await writeFile(
    join(TEST_DIR, "req-001.yaml"),
    [
      'id: "REQ-001"',
      "type: req",
      'title: "서비스별 권한 관리 필요"',
      "lifecycle: active",
    ].join("\n"),
  );

  // Non-spec file (ignored)
  await writeFile(join(TEST_DIR, "readme.txt"), "not a spec");
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadSpecs", () => {
  it("loads all valid specs from directory", async () => {
    const result = await loadSpecs(TEST_DIR);

    // 2 valid SpecDocuments (feat-003.json, req-001.yaml)
    expect(result.specs).toHaveLength(2);
    const ids = result.specs.map(s => s.id);
    expect(ids).toContain("FEAT-003");
    expect(ids).toContain("REQ-001");

    // 1 valid PrefixSpec
    expect(result.prefixes).toHaveLength(1);
    expect(result.prefixes[0].id).toBe("permission");

    // 1 error (invalid.json)
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toContain("invalid.json");
  });

  it("returns error for non-existent directory", async () => {
    const result = await loadSpecs("/nonexistent/path");
    expect(result.specs).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Directory not found");
  });
});

describe("parseSpecFile — JSON", () => {
  it("parses SpecDocument", () => {
    const content = JSON.stringify({
      id: "FEAT-001",
      type: "feat",
      title: "Test Feature",
      lifecycle: "draft",
    });

    const result = parseSpecFile("test.json", content);
    expect(result.kind).toBe("spec");
    if (result.kind === "spec") {
      expect(result.data.id).toBe("FEAT-001");
      expect(result.data.type).toBe("feat");
      expect(result.data.lifecycle).toBe("draft");
    }
  });

  it("parses PrefixSpec", () => {
    const content = JSON.stringify({
      id: "service",
      version: "v1",
      dims: { env: { kind: "axis", axisId: "env" } },
      export: { dims: ["env"], pattern: "{env}" },
    });

    const result = parseSpecFile("test.json", content);
    expect(result.kind).toBe("prefix");
    if (result.kind === "prefix") {
      expect(result.data.id).toBe("service");
      expect(result.data.export.pattern).toBe("{env}");
    }
  });

  it("throws on invalid SpecDocument", () => {
    const content = JSON.stringify({
      id: "FEAT-001",
      type: "invalid_type",
      title: "Test",
      lifecycle: "active",
    });

    expect(() => parseSpecFile("test.json", content)).toThrow("invalid 'type'");
  });

  it("throws on unknown format", () => {
    expect(() => parseSpecFile("test.xml", "<xml/>")).toThrow("Unsupported file format");
  });
});

describe("parseSpecFile — YAML", () => {
  it("parses simple flat YAML as SpecDocument", () => {
    const content = [
      'id: "ADR-001"',
      "type: adr",
      'title: "좌표계 도입 결정"',
      "lifecycle: deprecated",
    ].join("\n");

    const result = parseSpecFile("test.yaml", content);
    expect(result.kind).toBe("spec");
    if (result.kind === "spec") {
      expect(result.data.id).toBe("ADR-001");
      expect(result.data.type).toBe("adr");
      expect(result.data.lifecycle).toBe("deprecated");
    }
  });
});

describe("SpecDocument validation", () => {
  it("preserves optional fields", () => {
    const content = JSON.stringify({
      id: "FEAT-003",
      type: "feat",
      title: "Test",
      lifecycle: "active",
      rationale: "설계 근거",
      relations: [
        { from: "FEAT-003", to: "REQ-001", type: "satisfies" },
      ],
    });

    const result = parseSpecFile("test.json", content);
    if (result.kind === "spec") {
      expect(result.data.rationale).toBe("설계 근거");
      expect(result.data.relations).toHaveLength(1);
    }
  });

  it("omits optional fields when absent", () => {
    const content = JSON.stringify({
      id: "REQ-001",
      type: "req",
      title: "Test",
      lifecycle: "active",
    });

    const result = parseSpecFile("test.json", content);
    if (result.kind === "spec") {
      expect(result.data.rationale).toBeUndefined();
      expect(result.data.relations).toBeUndefined();
    }
  });
});
