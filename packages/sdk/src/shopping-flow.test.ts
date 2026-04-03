/**
 * 전체 쇼핑 흐름 시뮬레이션:
 * 로그인 → 홈 → 상품목록 → 상품상세 → 장바구니담기 → 장바구니 →
 * 결제 진입 → 결제 처리 → 결제 완료 → 완료 화면 → 창 닫기
 *
 * 각 단계에서 어떤 prefix가 어떤 layer에서 반짝거리는지 확인.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { createQaContext } from "@qa-sdk/context";
import { buildLayerMap, buildSvcOwnerMap, MonitorState, SERVICE_PROJECTION } from "@qa-sdk/spec-core/viz";
import type { AddressContextRecord } from "@qa-sdk/spec-core/convergence";
import type { TracePath } from "@qa-sdk/spec-core/viz";
import type { TypedQaContext } from "demo-types";
import { DSL_CHECKOUT, sdk } from "demo-types";

// 서비스 소유 매핑 — Projection이 발생 서비스 기반 layer를 결정
const DEMO_SVC_OWNERS = buildSvcOwnerMap([
  { serviceId: "shopping-web", ownedPrefixes: ["page_view", "tracking", "cart_event", "auth_event"] },
  { serviceId: "shopping-backend", ownedPrefixes: ["order_event", "permission", "event", "endpoint"] },
  { serviceId: "auth", ownedPrefixes: ["rbac"] },
  { serviceId: "gateway", ownedPrefixes: ["flow_point"] },
  { serviceId: "content-service", ownedPrefixes: ["content", "relational"] },
  { serviceId: "infra-controller", ownedPrefixes: ["deploy_event", "health_event", "pipeline_point", "data_policy", "engine_event", "schema_event", "service", "pattern_match", "pattern_anomaly", "ingest_record"] },
]);

describe("전체 쇼핑 흐름 시뮬레이션 — 로그인부터 창 닫기까지", () => {

  // TypedQaContext — prefix 자동완성 제공
  const qa: TypedQaContext = createQaContext({
    env: "prod", region: "asia", service: "shopping-web", namespace: "shop",
    catalog: DEMO_CATALOG, executionMode: "test", executionId: "shopping-e2e",
  });

  const layerMap = buildLayerMap(DEMO_CATALOG, SERVICE_PROJECTION, DEMO_SVC_OWNERS);
  const monitor = new MonitorState(DEMO_CATALOG, { windowSeconds: 300, svcOwners: DEMO_SVC_OWNERS });

  // 전체 흐름을 하나의 trace로 추적
  const traceId = "trace-shopping-full";
  const allRecords: AddressContextRecord[] = [];
  let stepTime = Date.now();

  function step(
    name: string,
    prefixes: Record<string, Record<string, string | number>>,
  ) {
    stepTime += 2000; // 2초 간격
    const tracked = qa.track(prefixes);
    const record: AddressContextRecord = {
      address_context: tracked.address_context,
      timestamp: new Date(stepTime).toISOString(),
      trace_id: traceId,
      session_id: "session-user-42",
      event_key: name,
      execution_mode: "test",
    };
    allRecords.push(record);
    monitor.push(record);
    return tracked;
  }

  it("13단계 쇼핑 흐름 시뮬레이션", () => {
    console.log("\n══ 전체 쇼핑 흐름 ══\n");

    // 1. 로그인
    step("1.login", {
      page_view: { page: "login", locale: "ko", userType: "guest" },
      auth_event: { action: "login" },
      tracking: { trackAction: "submit", page: "login", userType: "guest" },
    });

    // 2. 홈 화면
    step("2.home", {
      page_view: { page: "home", locale: "ko", userType: "member" },
      tracking: { trackAction: "view", page: "home", userType: "member" },
    });

    // 3. 상품 목록 조회
    step("3.product_list", {
      page_view: { page: "product_list", locale: "ko", userType: "member" },
      endpoint: { resource_type: "api", http_method: "GET", api_version: "v1" },
      tracking: { trackAction: "view", page: "product_list", userType: "member" },
    });

    // 4. 상품 상세 조회
    step("4.product_detail", {
      page_view: { page: "product_detail", locale: "ko", userType: "member" },
      endpoint: { resource_type: "api", http_method: "GET", api_version: "v1" },
      tracking: { trackAction: "click", page: "product_detail", userType: "member" },
    });

    // 5. 장바구니 담기
    step("5.add_to_cart", {
      page_view: { page: "product_detail", locale: "ko", userType: "member" },
      endpoint: { resource_type: "api", http_method: "POST", api_version: "v1" },
      cart_event: { action: "add" },
      tracking: { trackAction: "add_to_cart", page: "product_detail", userType: "member" },
    });

    // 6. 장바구니 화면
    step("6.cart", {
      page_view: { page: "cart", locale: "ko", userType: "member" },
      endpoint: { resource_type: "api", http_method: "GET", api_version: "v1" },
      tracking: { trackAction: "view", page: "cart", userType: "member" },
    });

    // 7. 결제 진입
    step("7.checkout_entry", {
      page_view: { page: "checkout", locale: "ko", userType: "member" },
      flow_point: { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
      tracking: { trackAction: "navigate", page: "checkout", userType: "member" },
    });

    // 8. 결제 처리 (권한 검사 + 주문 생성)
    step("8.checkout_process", {
      endpoint: { resource_type: "api", http_method: "POST", api_version: "v1" },
      permission: { role: "customer" },
      order_event: { action: "create" },
      flow_point: { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
    });

    // 9. 결제 진행
    step("9.payment", {
      endpoint: { resource_type: "api", http_method: "POST", api_version: "v1" },
      flow_point: { flow_name: "payment", flow_step: "payment", flow_variant: "default" },
    });

    // 10. 결제 성공
    step("10.payment_success", {
      order_event: { action: "complete" },
      flow_point: { flow_name: "checkout", flow_step: "success", flow_variant: "default" },
    });

    // 11. 완료 화면
    step("11.order_complete", {
      page_view: { page: "order_complete", locale: "ko", userType: "member" },
      tracking: { trackAction: "view", page: "order_complete", userType: "member" },
      flow_point: { flow_name: "checkout", flow_step: "complete", flow_variant: "default" },
    });

    // 12. 마이페이지 (선택)
    step("12.mypage", {
      page_view: { page: "mypage", locale: "ko", userType: "member" },
      tracking: { trackAction: "navigate", page: "mypage", userType: "member" },
    });

    // 13. 창 닫기 / 이탈
    step("13.exit", {
      tracking: { trackAction: "close", page: "mypage", userType: "member" },
      flow_point: { flow_name: "browse", flow_step: "exit", flow_variant: "default" },
      auth_event: { action: "logout" },
    });

    // ── 결과 분석 ──

    // 전체 경로 추적
    const paths = monitor.getRecentPaths(1);
    const path = paths.find(p => p.traceId === traceId);

    console.log("  단계별 prefix 활성화:\n");
    for (const r of allRecords) {
      const prefixes = Object.keys(r.address_context).filter(p => p !== "service");
      const layers = prefixes.map(p => {
        const placement = layerMap.placementMap.get(p);
        return placement ? `L${placement.layer}` : "?";
      });
      console.log(`  ${(r.event_key ?? "").padEnd(22)} ${layers.join(" ")} — ${prefixes.join(", ")}`);
    }

    console.log(`\n  총 단계: ${allRecords.length}`);
    console.log(`  trace: ${traceId}`);
    if (path) {
      console.log(`  경로: L${path.layerPath.join("→L")}`);
      console.log(`  duration: ${path.duration}ms`);
      console.log(`  steps: ${path.steps.length}`);
    }

    // 계층별 활성 요약
    const summary = monitor.getLayerSummary();
    console.log("\n  계층별 활성:");
    for (const s of summary) {
      console.log(`    L${s.layer} ${s.name.padEnd(20)} active=${s.activeCount}`);
    }

    // 활성 prefix top 5
    const activity = monitor.getActivity();
    console.log("\n  활성 prefix Top 5:");
    for (const a of activity.slice(0, 5)) {
      console.log(`    L${a.layer} ${a.prefixId.padEnd(15)} ${a.count}건 (${(a.intensity * 100).toFixed(0)}%)`);
    }

    // 검증
    expect(allRecords.length).toBe(13);
    expect(path).toBeDefined();
    expect(path!.steps.length).toBeGreaterThan(20); // 13 단계 × 여러 prefix
    // Layer 0 (page_view, tracking) → Layer 1 (endpoint, flow_point, permission) → Layer 2는 간접
    expect(path!.layerPath).toContain(0); // UI
    expect(path!.layerPath).toContain(1); // Business
    // 모든 주요 prefix 활성
    expect(activity.some(a => a.prefixId === "page_view")).toBe(true);
    expect(activity.some(a => a.prefixId === "endpoint")).toBe(true);
    expect(activity.some(a => a.prefixId === "tracking")).toBe(true);
    expect(activity.some(a => a.prefixId === "flow_point")).toBe(true);
  });

  it("생성된 DSL_CHECKOUT const 검증", () => {
    // codegen에서 생성된 DSL 상수와 실제 사용 멤버가 일치하는지 확인
    expect(DSL_CHECKOUT.id).toBe("dsl-checkout");
    expect(DSL_CHECKOUT.members).toContain("page_view");
    expect(DSL_CHECKOUT.members).toContain("endpoint");
    expect(DSL_CHECKOUT.members).toContain("flow_point");
    expect(DSL_CHECKOUT.serviceBindingPrefix).toBe("service");
  });

  it("생성된 sdk로 encode/decode 라운드트립", () => {
    // codegen에서 생성된 createIndexSDK 인스턴스
    const addr = sdk.encode("permission", { role: "admin" });
    const decoded = sdk.decode("permission", addr);
    expect(decoded.role).toBe("admin");
  });
});
