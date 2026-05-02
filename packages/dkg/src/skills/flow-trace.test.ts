// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * flow-trace 단위 테스트 — IntentLink invariant 위반 감지.
 */
import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { traceFlows, validateDslInvariants } from "./flow-trace.js";
import type { AddressContextRecord } from "@qa-sdk/convergence";

describe("traceFlows — IntentLink invariant 검증", () => {
  const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

  it("IL-checkout-flow 전체 endpoint 포함 시 해당 IL 위반 없음", () => {
    // 전체 prefix를 DKG에서 파생하여 address_context 구성 (SSOT)
    const allPrefixes = graph.getNodesByKind("prefix");
    const ac: Record<string, string> = {};
    for (const p of allPrefixes) {
      ac[p.id] = `${p.id}:v1:0`;
    }

    const records: AddressContextRecord[] = [
      { address_context: ac, timestamp: "2026-03-20T00:00:00Z", session_id: "test-session" },
    ];

    const result = traceFlows(graph, records);
    // 전체 prefix 포함이므로 어떤 IL도 위반하지 않아야 함
    expect(result.violations.length).toBe(0);
    expect(result.checkedRecords).toBe(1);
  });

  it("page_view 없이 flow_point만 있으면 IL-checkout-flow 위반", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          // page_view 누락!
          flow_point: "flow_point:v2:0",
          order_event: "order_event:v1:0",
        },
        timestamp: "2026-03-20T00:00:00Z",
        session_id: "test-session",
      },
    ];

    const result = traceFlows(graph, records);

    // IL-checkout-flow invariant: "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨"
    const checkoutViolation = result.violations.find(v => v.intentLinkId === "IL-checkout-flow");
    expect(checkoutViolation).toBeDefined();
    expect(checkoutViolation!.missingPrefixes).toContain("page_view");
  });

  it("위반 시 observation이 자동 생성됨", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          flow_point: "flow_point:v2:0",
          endpoint: "endpoint:v1:0",
        },
        timestamp: "2026-03-20T00:00:00Z",
        session_id: "test-session",
      },
    ];

    const result = traceFlows(graph, records);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.observations[0].id).toContain("OBS-FLOW-");
    expect(result.observations[0].source).toBe("runtime");
  });

  it("IntentLink와 무관한 레코드는 건너뜀", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          relational: "relational:v1:0", // relational은 어떤 IntentLink에도 속하지 않음
        },
        timestamp: "2026-03-20T00:00:00Z",
        session_id: "test-session",
      },
    ];

    const result = traceFlows(graph, records);
    expect(result.violations.length).toBe(0);
    expect(result.checkedRecords).toBe(1);
  });

  it("빈 레코드 배열 → 위반 없음", () => {
    const result = traceFlows(graph, []);
    expect(result.violations.length).toBe(0);
    expect(result.totalRecords).toBe(0);
    expect(result.checkedRecords).toBe(0);
  });
});

describe("validateDslInvariants — DSL 번들 불변조건 검증", () => {
  const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

  it("전체 memberPrefix 포함 시 해당 DSL 위반 없음", () => {
    const allPrefixes = graph.getNodesByKind("prefix");
    const ac: Record<string, string> = {};
    for (const p of allPrefixes) {
      ac[p.id] = `${p.id}:v1:0`;
    }

    const records: AddressContextRecord[] = [
      { address_context: ac, timestamp: "2026-03-24T00:00:00Z", session_id: "test" },
    ];

    const result = validateDslInvariants(graph, records);
    expect(result.violations.length).toBe(0);
    expect(result.checkedRecords).toBe(1);
  });

  it("dsl-observation: page_view 없이 flow_point만 있으면 위반", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          flow_point: "flow_point:v2:0",
          endpoint: "endpoint:v1:0",
          pattern_match: "pattern_match:v1:0",
        },
        timestamp: "2026-03-24T00:00:00Z",
        session_id: "test",
      },
    ];

    const result = validateDslInvariants(graph, records);
    const obsViolation = result.violations.find(v => v.bundleId === "dsl-observation");
    expect(obsViolation).toBeDefined();
    expect(obsViolation!.invariant).toContain("page_view 없이");
  });

  it("dsl-checkout: page_view 없이 flow_point만 있으면 위반", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          flow_point: "flow_point:v2:0",
          order_event: "order_event:v1:0",
        },
        timestamp: "2026-03-24T00:00:00Z",
        session_id: "test",
      },
    ];

    const result = validateDslInvariants(graph, records);
    const checkoutViolation = result.violations.find(v => v.bundleId === "dsl-checkout");
    expect(checkoutViolation).toBeDefined();
    expect(checkoutViolation!.invariant).toContain("checkout");
  });

  it("excludeBundles로 특정 번들 제외 가능", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          flow_point: "flow_point:v2:0",
          order_event: "order_event:v1:0",
        },
        timestamp: "2026-03-24T00:00:00Z",
        session_id: "test",
      },
    ];

    const result = validateDslInvariants(graph, records, { excludeBundles: ["dsl-checkout", "dsl-observation"] });
    // dsl-checkout과 dsl-observation 제외 → 해당 위반 없음
    expect(result.violations.filter(v => v.bundleId === "dsl-checkout").length).toBe(0);
    expect(result.violations.filter(v => v.bundleId === "dsl-observation").length).toBe(0);
  });

  it("위반 시 observation이 자동 생성됨", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: {
          flow_point: "flow_point:v2:0",
          endpoint: "endpoint:v1:0",
        },
        timestamp: "2026-03-24T00:00:00Z",
        session_id: "test",
      },
    ];

    const result = validateDslInvariants(graph, records);
    if (result.violations.length > 0) {
      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.observations[0].id).toContain("OBS-DSL-");
    }
  });

  it("빈 레코드 → 위반 없음", () => {
    const result = validateDslInvariants(graph, []);
    expect(result.violations.length).toBe(0);
    expect(result.checkedRecords).toBe(0);
  });
});
