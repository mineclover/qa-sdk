/**
 * codegen 기본 테스트 — IR → TS/JS/Proto/JSON Schema 변환 검증.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, getPrefixShape } from "demo-snapshot";
import { catalogToPrefixSpecs } from "../loader/catalog-bridge.js";
import { buildIR } from "./ir-builder.js";
import { generateFromIR, generateTypescriptFile } from "./ts-generator.js";
import { generateJSFromIR } from "./js-generator.js";
import { generateProtoFromIR } from "./proto-generator.js";
import { generateJsonSchemaFromIR } from "./json-schema-generator.js";

describe("codegen — IR 생성", () => {
  it("DEMO_CATALOG → IR 생성", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const axes = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      return { id, entries: [...latest.entries], capacity: latest.capacity };
    });

    const ir = buildIR({ axes, prefixSpecs: specs });

    expect(ir.enums.length).toBeGreaterThan(0);
    expect(ir.structs.length).toBeGreaterThan(0);

    // role enum이 있어야 함
    const roleEnum = ir.enums.find(e => e.id === "role");
    expect(roleEnum).toBeDefined();
    expect(roleEnum!.values.some(v => v.name === "admin")).toBe(true);

    // endpoint struct가 있어야 함
    const endpointStruct = ir.structs.find(s => s.id === "endpoint");
    expect(endpointStruct).toBeDefined();

    console.log(`\n  IR: ${ir.enums.length} enums, ${ir.structs.length} structs`);
  });
});

describe("codegen — TypeScript 출력", () => {
  it("IR → TypeScript 코드 생성", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const axes = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      return { id, entries: [...latest.entries], capacity: latest.capacity };
    });

    const ir = buildIR({ axes, prefixSpecs: specs });
    const ts = generateFromIR(ir);

    // TypeScript 출력에 핵심 요소 포함
    expect(ts).toContain("export type"); // enum type
    expect(ts).toContain("export interface"); // struct interface
    expect(ts).toContain("admin"); // role enum value
    expect(ts.length).toBeGreaterThan(100);

    console.log(`\n  TS output: ${ts.length} chars, ${ts.split("\n").length} lines`);
  });
});

describe("codegen — JS 출력", () => {
  it("IR → ESM JavaScript 코드 생성", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const axes = Object.entries(DEMO_CATALOG.axes).slice(0, 5).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      return { id, entries: [...latest.entries], capacity: latest.capacity };
    });

    const ir = buildIR({ axes, prefixSpecs: specs.slice(0, 3) });
    const js = generateJSFromIR(ir, "esm");

    expect(js).toContain("export"); // ESM export
    expect(js.length).toBeGreaterThan(50);
  });
});

describe("codegen — Protobuf 출력", () => {
  it("IR → Proto 코드 생성", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const axes = Object.entries(DEMO_CATALOG.axes).slice(0, 5).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      return { id, entries: [...latest.entries], capacity: latest.capacity };
    });

    const ir = buildIR({ axes, prefixSpecs: specs.slice(0, 3) });
    const proto = generateProtoFromIR(ir);

    expect(proto).toContain("syntax"); // proto syntax
    expect(proto).toContain("enum"); // enum definition
    expect(proto.length).toBeGreaterThan(50);
  });
});

describe("codegen — JSON Schema 출력", () => {
  it("IR → JSON Schema 생성", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const axes = Object.entries(DEMO_CATALOG.axes).slice(0, 5).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      return { id, entries: [...latest.entries], capacity: latest.capacity };
    });

    const ir = buildIR({ axes, prefixSpecs: specs.slice(0, 3) });
    const jsonSchema = generateJsonSchemaFromIR(ir);

    const parsed = JSON.parse(jsonSchema);
    expect(parsed).toBeDefined();
    expect(parsed.$schema || parsed.definitions || parsed.type).toBeDefined();
  });
});
