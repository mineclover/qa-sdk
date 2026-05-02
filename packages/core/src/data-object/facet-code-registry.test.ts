// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { FacetCodeRegistry, resolveFacetMappings } from "./facet-code-registry.js";
import type { FacetCodeMapping } from "./types.js";
import type { PipeGraph } from "../types/pipe-spec.js";

const mapping = (facet: string, file: string, opts?: { symbol?: string; schemaId?: string }): FacetCodeMapping => ({
  facet,
  implementations: [{ file, symbol: opts?.symbol }],
  schemaId: opts?.schemaId,
});

describe("FacetCodeRegistry", () => {
  it("register + getByFacet", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("결제검증", "payment/validate.ts", { symbol: "checkPayment" }));

    const result = reg.getByFacet("결제검증");
    expect(result).not.toBeNull();
    expect(result!.facet).toBe("결제검증");
    expect(result!.implementations[0].file).toBe("payment/validate.ts");
    expect(result!.implementations[0].symbol).toBe("checkPayment");
  });

  it("중복 등록 시 에러", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("결제", "a.ts"));
    expect(() => reg.register(mapping("결제", "b.ts"))).toThrow("already registered");
  });

  it("getByFile — 파일별 조회", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("검증", "validate.ts"));
    reg.register(mapping("변환", "validate.ts"));
    reg.register(mapping("저장", "store.ts"));

    const results = reg.getByFile("validate.ts");
    expect(results).toHaveLength(2);
    expect(results.map(r => r.facet).sort()).toEqual(["검증", "변환"]);
  });

  it("getBySchema — 스키마별 조회", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("주문검증", "a.ts", { schemaId: "orders" }));
    reg.register(mapping("주문전송", "b.ts", { schemaId: "orders" }));
    reg.register(mapping("결제", "c.ts", { schemaId: "payments" }));

    expect(reg.getBySchema("orders")).toHaveLength(2);
    expect(reg.getBySchema("payments")).toHaveLength(1);
    expect(reg.getBySchema("없음")).toHaveLength(0);
  });

  it("remove + listAll", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("a", "a.ts"));
    reg.register(mapping("b", "b.ts"));
    expect(reg.listAll()).toHaveLength(2);

    expect(reg.remove("a")).toBe(true);
    expect(reg.listAll()).toHaveLength(1);
    expect(reg.getByFacet("a")).toBeNull();

    expect(reg.remove("없는것")).toBe(false);
  });

  it("remove — 인덱스 정리 확인", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("검증", "validate.ts", { schemaId: "orders" }));
    reg.remove("검증");

    expect(reg.getByFile("validate.ts")).toHaveLength(0);
    expect(reg.getBySchema("orders")).toHaveLength(0);
  });
});

describe("resolveFacetMappings", () => {
  it("PipeGraph의 모든 step.facet 매핑 조회", () => {
    const reg = new FacetCodeRegistry();
    reg.register(mapping("검증", "validate.ts"));
    // "결제"는 미등록 → null

    const graph: PipeGraph = {
      graphId: "g1",
      version: "v1",
      pipes: [
        {
          pipeId: "p1",
          version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "sequence",
            steps: [
              { kind: "step", facet: "검증" },
              { kind: "step", facet: "결제" },
            ],
          },
        },
      ],
      connections: [],
      entryPipeId: "p1",
    };

    const results = resolveFacetMappings(graph, reg);
    expect(results).toHaveLength(2);

    const mapped = results.find(r => r.facet === "검증");
    expect(mapped!.mapping).not.toBeNull();

    const unmapped = results.find(r => r.facet === "결제");
    expect(unmapped!.mapping).toBeNull();
  });
});
