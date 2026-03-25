import { describe, it, expect } from "vitest";
import { createGateOpenAPIApp } from "./gate-openapi.js";
import type { GateLookupService } from "../lib/gate-service.js";

const mockService: GateLookupService = {
  engine: null,
  checkGate: async () => ({ encode: true, decode: true, state: "active" as const, shouldVerify: false }),
  classifyAddress: async () => "active" as const,
  recompute: async () => {},
  cascadeRecompute: async () => {},
  filterRanges: async () => [],
  getStateRanges: async () => null,
};

describe("Gate OpenAPI", () => {
  it("OpenAPI 3.1 JSON을 생성한다", () => {
    const app = createGateOpenAPIApp({ gateService: mockService, engineConfigured: false });
    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Gate Service API", version: "1.0.0" },
    });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Gate Service API");
    expect(spec.paths).toBeDefined();
  });

  it("6개 Gate 엔드포인트 + health가 정의된다", () => {
    const app = createGateOpenAPIApp({ gateService: mockService, engineConfigured: false });
    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Gate Service API", version: "1.0.0" },
    });

    const paths = Object.keys(spec.paths || {});
    expect(paths).toContain("/gate/check");
    expect(paths).toContain("/gate/classify");
    expect(paths).toContain("/gate/recompute");
    expect(paths).toContain("/gate/cascade-recompute");
    expect(paths).toContain("/gate/filter-ranges");
    expect(paths).toContain("/gate/state/{prefix}/{version}");
    expect(paths).toContain("/health");
  });

  it("스키마 정의가 포함된다", () => {
    const app = createGateOpenAPIApp({ gateService: mockService, engineConfigured: false });
    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Gate Service API", version: "1.0.0" },
    });

    const schemas = spec.components?.schemas || {};
    expect(schemas).toHaveProperty("GateCheckResponse");
    expect(schemas).toHaveProperty("GateFilterResponse");
    expect(schemas).toHaveProperty("HealthResponse");
  });

  it("OpenAPI JSON을 파일로 출력할 수 있다", () => {
    const app = createGateOpenAPIApp({ gateService: mockService, engineConfigured: false });
    const spec = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Gate Service API", version: "1.0.0" },
    });

    const json = JSON.stringify(spec, null, 2);
    expect(json.length).toBeGreaterThan(500);
    expect(JSON.parse(json).openapi).toBe("3.1.0");
  });
});
