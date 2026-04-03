import { describe, it, expect } from "vitest";
import { resolveStepSchemaId } from "./pipe-schema-id.js";
import type { PipeStep } from "../types/pipe-spec.js";

function step(overrides?: Partial<PipeStep>): PipeStep {
  return { kind: "step", facet: "처리", ...overrides };
}

describe("resolveStepSchemaId", () => {
  it("writable accesses 단일 → schemaId 사용", () => {
    const s = step({
      dataContract: {
        accesses: [{ schemaId: "orders", columns: ["id"], mode: "write" }],
      },
    });
    expect(resolveStepSchemaId(s, "fallback")).toBe("orders");
  });

  it("writable accesses 다수 → read-only fallback", () => {
    const s = step({
      dataContract: {
        accesses: [
          { schemaId: "orders", columns: ["id"], mode: "write" },
          { schemaId: "payments", columns: ["id"], mode: "write" },
        ],
      },
    });
    // writable 2개 → skip, readable도 없음 → eventKey ?? facet
    expect(resolveStepSchemaId(s, "fallback")).toBe("처리");
  });

  it("read-only accesses 단일 → schemaId 사용", () => {
    const s = step({
      dataContract: {
        accesses: [{ schemaId: "users", columns: ["name"], mode: "read" }],
      },
    });
    expect(resolveStepSchemaId(s, "fallback")).toBe("users");
  });

  it("accesses 없음, eventKey 있음 → eventKey", () => {
    const s = step({ eventKey: "order.created" });
    expect(resolveStepSchemaId(s, "fallback")).toBe("order.created");
  });

  it("accesses 없음, eventKey 없음, facet 있음 → facet", () => {
    const s = step({ facet: "결제" });
    expect(resolveStepSchemaId(s, "fallback")).toBe("결제");
  });

  it("전부 없음 → fallback", () => {
    const s: PipeStep = { kind: "step", facet: undefined as unknown as string };
    expect(resolveStepSchemaId(s, "my-pipe")).toBe("my-pipe");
  });

  it("readwrite accesses → writable 우선 매칭", () => {
    const s = step({
      dataContract: {
        accesses: [{ schemaId: "audit_log", columns: ["id"], mode: "readwrite" }],
      },
    });
    expect(resolveStepSchemaId(s, "fallback")).toBe("audit_log");
  });
});
