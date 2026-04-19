// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { docRowToRegistryInput, type DocRow } from "./registry-helpers.js";

const baseRow: DocRow = {
  docId: "test-doc",
  title: "Test Document",
  scope: "feature",
  aspect: "func_def",
  depth: "specification",
  lifecycle: "approved",
  tags: ["structural"],
};

describe("docRowToRegistryInput", () => {
  it("필수 필드만 있는 row → 최소 DefinitionEntryInput", () => {
    const input = docRowToRegistryInput(baseRow);
    expect(input.id).toBe("test-doc");
    expect(input.title).toBe("Test Document");
    expect(input.scope).toBe("feature");
    expect(input.aspect).toBe("func_def");
    expect(input.depth).toBe("specification");
    expect(input.lifecycle).toBe("approved");
    expect(input.createdAt).toBe("");
    expect(input.updatedAt).toBe("");
  });

  it("title null → docId로 대체", () => {
    const input = docRowToRegistryInput({ ...baseRow, title: null });
    expect(input.title).toBe("test-doc");
  });

  it("docType 우선, type fallback", () => {
    const input1 = docRowToRegistryInput({ ...baseRow, docType: "knowledge", type: "spec" });
    expect(input1.type).toBe("knowledge");

    const input2 = docRowToRegistryInput({ ...baseRow, type: "spec" });
    expect(input2.type).toBe("spec");
  });

  it("optional 필드 — 있으면 포함, 없으면 제외", () => {
    const full = docRowToRegistryInput({
      ...baseRow,
      knowledgeKind: "concept",
      level: "module",
      layer: "domain",
      svc: "ingest-server",
      sourcePath: "packages/ingest-server/src/server.ts",
      syncedAt: "2026-04-05T00:00:00Z",
    });
    expect(full.knowledgeKind).toBe("concept");
    expect(full.level).toBe("module");
    expect(full.layer).toBe("domain");
    expect(full.serviceId).toBe("ingest-server");
    expect(full.ref).toBe("packages/ingest-server/src/server.ts");
    expect(full.createdAt).toBe("2026-04-05T00:00:00Z");
  });

  it("optional 필드 null → 제외", () => {
    const minimal = docRowToRegistryInput({
      ...baseRow,
      knowledgeKind: null,
      level: null,
      layer: null,
      svc: null,
      sourcePath: null,
    });
    expect(minimal.knowledgeKind).toBeUndefined();
    expect(minimal.level).toBeUndefined();
    expect(minimal.layer).toBeUndefined();
    expect(minimal.serviceId).toBeUndefined();
    expect(minimal.ref).toBeUndefined();
  });

  it("tags 비어있으면 제외, 있으면 복사", () => {
    const noTags = docRowToRegistryInput({ ...baseRow, tags: [] });
    expect(noTags.tags).toBeUndefined();

    const withTags = docRowToRegistryInput({ ...baseRow, tags: ["security", "testing"] });
    expect(withTags.tags).toEqual(["security", "testing"]);
  });

  it("tags는 원본 배열과 독립적 (방어적 복사)", () => {
    const originalTags = ["a", "b"];
    const input = docRowToRegistryInput({ ...baseRow, tags: originalTags });
    expect(input.tags).toEqual(["a", "b"]);
    expect(input.tags).not.toBe(originalTags);
  });
});
