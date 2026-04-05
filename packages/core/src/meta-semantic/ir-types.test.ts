import { describe, it, expect } from "vitest";
import {
  inferModuleLevel,
  computeSchemaHash,
  deriveCertainty,
  type ModuleRelations,
  type FieldDescriptor,
} from "./ir-types.js";

describe("inferModuleLevel", () => {
  it("children 없으면 leaf", () => {
    const r: ModuleRelations = { parent: { moduleId: "p" }, children: [], internal: [], external: [] };
    expect(inferModuleLevel(r)).toBe("leaf");
  });

  it("parent 없고 children 있으면 group", () => {
    const r: ModuleRelations = { parent: null, children: [{ moduleId: "c" }], internal: [], external: [] };
    expect(inferModuleLevel(r)).toBe("group");
  });

  it("parent 있고 children 있으면 module", () => {
    const r: ModuleRelations = { parent: { moduleId: "p" }, children: [{ moduleId: "c" }], internal: [], external: [] };
    expect(inferModuleLevel(r)).toBe("module");
  });
});

describe("computeSchemaHash", () => {
  it("같은 필드면 같은 해시", () => {
    const fields: FieldDescriptor[] = [
      { name: "id", type: "string", optional: false, hasDefault: false },
      { name: "name", type: "string", optional: true, hasDefault: false },
    ];
    expect(computeSchemaHash(fields)).toBe(computeSchemaHash(fields));
  });

  it("필드 순서 무관 (정렬됨)", () => {
    const a: FieldDescriptor[] = [
      { name: "name", type: "string", optional: true, hasDefault: false },
      { name: "id", type: "string", optional: false, hasDefault: false },
    ];
    const b: FieldDescriptor[] = [
      { name: "id", type: "string", optional: false, hasDefault: false },
      { name: "name", type: "string", optional: true, hasDefault: false },
    ];
    expect(computeSchemaHash(a)).toBe(computeSchemaHash(b));
  });

  it("필드 다르면 다른 해시", () => {
    const a: FieldDescriptor[] = [{ name: "id", type: "string", optional: false, hasDefault: false }];
    const b: FieldDescriptor[] = [{ name: "id", type: "number", optional: false, hasDefault: false }];
    expect(computeSchemaHash(a)).not.toBe(computeSchemaHash(b));
  });
});

describe("deriveCertainty", () => {
  it("concrete 타입만이면 strict", () => {
    const fields: FieldDescriptor[] = [
      { name: "id", type: "string", optional: false, hasDefault: false },
      { name: "count", type: "number", optional: false, hasDefault: false },
    ];
    expect(deriveCertainty(fields)).toBe("strict");
  });

  it("any 포함이면 flexible", () => {
    const fields: FieldDescriptor[] = [
      { name: "data", type: "any", optional: false, hasDefault: false },
    ];
    expect(deriveCertainty(fields)).toBe("flexible");
  });

  it("Record<string, unknown> 포함이면 flexible", () => {
    const fields: FieldDescriptor[] = [
      { name: "meta", type: "Record<string, unknown>", optional: true, hasDefault: false },
    ];
    expect(deriveCertainty(fields)).toBe("flexible");
  });
});
