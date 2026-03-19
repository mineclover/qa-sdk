import { describe, it, expect, beforeEach } from "vitest";
import { SpecDocumentRegistry } from "./spec-document.registry.js";
import type { SpecDocument } from "./spec.types.js";

const req001: SpecDocument = {
  id: "REQ-001",
  type: "req",
  title: "서비스별 권한 관리 필요",
  lifecycle: "active",
};

const feat003: SpecDocument = {
  id: "FEAT-003",
  type: "feat",
  title: "서비스별 역할 권한 분리",
  lifecycle: "active",
  relations: [
    { from: "FEAT-003", to: "REQ-001", type: "satisfies" },
  ],
};

const feat003Ls01: SpecDocument = {
  id: "FEAT-003-LS-01",
  type: "ls",
  title: "권한 인코딩 로직",
  lifecycle: "active",
  relations: [
    { from: "FEAT-003-LS-01", to: "FEAT-003", type: "implements" },
  ],
};

describe("SpecDocumentRegistry", () => {
  let registry: SpecDocumentRegistry;

  beforeEach(() => {
    registry = new SpecDocumentRegistry();
    registry.register(req001);
    registry.register(feat003);
    registry.register(feat003Ls01);
  });

  it("registers and retrieves documents", () => {
    expect(registry.has("FEAT-003")).toBe(true);
    expect(registry.get("FEAT-003").title).toBe("서비스별 역할 권한 분리");
    expect(registry.size).toBe(3);
  });

  describe("relationsFrom", () => {
    it("returns outgoing relations", () => {
      const rels = registry.relationsFrom("FEAT-003");
      expect(rels).toHaveLength(1);
      expect(rels[0].to).toBe("REQ-001");
      expect(rels[0].type).toBe("satisfies");
    });

    it("returns empty for document with no outgoing relations", () => {
      const rels = registry.relationsFrom("REQ-001");
      expect(rels).toHaveLength(0);
    });
  });

  describe("relationsTo", () => {
    it("finds all documents that reference a target", () => {
      const rels = registry.relationsTo("REQ-001");
      expect(rels).toHaveLength(1);
      expect(rels[0].from).toBe("FEAT-003");
    });

    it("finds implements relations", () => {
      const rels = registry.relationsTo("FEAT-003");
      expect(rels).toHaveLength(1);
      expect(rels[0].from).toBe("FEAT-003-LS-01");
      expect(rels[0].type).toBe("implements");
    });
  });

  describe("getByLifecycle", () => {
    it("filters by lifecycle", () => {
      registry.register({
        id: "ADR-001",
        type: "adr",
        title: "좌표계 도입 결정",
        lifecycle: "deprecated",
      });

      const active = registry.getByLifecycle("active");
      expect(active).toHaveLength(3);

      const deprecated = registry.getByLifecycle("deprecated");
      expect(deprecated).toHaveLength(1);
      expect(deprecated[0].id).toBe("ADR-001");
    });
  });

  describe("traceability path", () => {
    it("traces REQ → FEAT → LS", () => {
      // REQ-001 ← satisfies ← FEAT-003 ← implements ← FEAT-003-LS-01
      const toReq = registry.relationsTo("REQ-001");
      expect(toReq[0].from).toBe("FEAT-003");

      const toFeat = registry.relationsTo("FEAT-003");
      expect(toFeat[0].from).toBe("FEAT-003-LS-01");
    });
  });
});
