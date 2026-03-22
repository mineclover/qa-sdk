/**
 * flow-trace 단위 테스트 — IntentLink invariant 위반 감지.
 */
import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { traceFlows } from "./flow-trace.js";
import type { AddressContextRecord } from "@qa-sdk/convergence";

describe("traceFlows — IntentLink invariant 검증", () => {
  const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

  it("IL-checkout-flow 전체 endpoint 포함 시 해당 IL 위반 없음", () => {
    // IL-checkout-flow의 5개 endpoint 전부 포함 + cart/tracking도 포함해 다른 IL도 충족
    const records: AddressContextRecord[] = [
      {
        address_context: {
          page_view: "page_view:v2:0",
          endpoint: "endpoint:v1:0",
          flow_point: "flow_point:v2:0",
          order_event: "order_event:v1:0",
          permission: "permission:v4:0",
          cart_event: "cart_event:v1:0",
          tracking: "tracking:v2:0",
          pattern_match: "pattern_match:v1:0",
          pattern_anomaly: "pattern_anomaly:v2:0",
          deploy_event: "deploy_event:v1:0",
          health_event: "health_event:v1:0",
          pipeline_point: "pipeline_point:v1:0",
          engine_event: "engine_event:v1:0",
          schema_event: "schema_event:v1:0",
          event: "event:v4:0",
        },
        timestamp: "2026-03-20T00:00:00Z",
        session_id: "test-session",
      },
    ];

    const result = traceFlows(graph, records);
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
          content: "content:v1:0", // content는 어떤 IntentLink에도 속하지 않음
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
