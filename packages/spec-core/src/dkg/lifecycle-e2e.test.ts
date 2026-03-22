/**
 * 종단 라이프사이클 E2E — DSL DB 전체 증명.
 *
 * 의사결정(prefix 정의) → 고정(encode) → 운용(decode) →
 * 관측(flow_point) → 마이그레이션(resolve) → 영향 분석(DKG)
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG, encodePrefixByValue, decodePrefix } from "demo-snapshot";
import { bootstrapDkg } from "./bootstrap.js";
import { resolve } from "./resolve.js";
import { defineFlow, serializeFlow, deserializeFlow } from "./flow-definition.js";
import { analyzeImpact } from "./skills/analyze-impact.js";

describe("종단 E2E: checkout 흐름", () => {
  const _pvRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
  const _fpRef = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];

  it("1. FlowDefinition으로 관측 포인트 정의", () => {
    const flow = defineFlow(DEMO_CATALOG, {
      id: "checkout-flow",
      name: "결제 흐름",
      description: "장바구니 → 결제 시도 → 성공/실패/취소",
      entry: {
        prefix: "page_view", version: "v1",
        values: { svc_ref: _pvRef, page: "checkout", locale: "ko", userType: "member" },
      },
      branches: {
        orderCreate: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
        },
        success: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "checkout", flow_step: "success", flow_variant: "default" },
        },
        failure: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "checkout", flow_step: "failure", flow_variant: "default" },
        },
        retry: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "checkout", flow_step: "branch", flow_variant: "retry" },
        },
      },
    });

    // 각 관측 포인트가 정수 주소를 가진다
    expect(typeof flow.entry.address).toBe("number");
    expect(typeof flow.branches.success.address).toBe("number");
    expect(typeof flow.branches.failure.address).toBe("number");

    // 서로 다른 주소
    expect(flow.branches.success.address).not.toBe(flow.branches.failure.address);
  });

  it("2. FlowDefinition 직렬화/역직렬화 라운드트립", () => {
    const flow = defineFlow(DEMO_CATALOG, {
      id: "signup-flow",
      name: "가입 흐름",
      entry: {
        prefix: "page_view", version: "v1",
        values: { svc_ref: _pvRef, page: "home", locale: "ko", userType: "guest" },
      },
      branches: {
        submit: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "signup", flow_step: "processing", flow_variant: "default" },
        },
        complete: {
          prefix: "flow_point", version: "v1",
          values: { svc_ref: _fpRef, flow_name: "signup", flow_step: "success", flow_variant: "default" },
        },
      },
    });

    const json = serializeFlow(flow);
    const restored = deserializeFlow(json);

    expect(restored.id).toBe(flow.id);
    expect(restored.entry.address).toBe(flow.entry.address);
    expect(restored.branches.submit.address).toBe(flow.branches.submit.address);
  });

  it("3. encode → decode 라운드트립 (모든 새 prefix)", () => {
    const refValues = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values;
    // page_view
    const pvSvcRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
    const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
      svc_ref: pvSvcRef, page: "checkout", locale: "ko", userType: "premium",
    });
    const pvDecoded = decodePrefix(DEMO_CATALOG, "page_view", "v1", pvAddr);
    expect(pvDecoded.page.value).toBe("checkout");
    expect(pvDecoded.locale.value).toBe("ko");
    expect(pvDecoded.userType.value).toBe("premium");

    // endpoint (api_path는 좌표 밖 — resource_type + method + version만)
    const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
      svc_ref: refValues[0], resource_type: "api", http_method: "POST", api_version: "v2",
    });
    const epDecoded = decodePrefix(DEMO_CATALOG, "endpoint", "v1", epAddr);
    expect(epDecoded.http_method.value).toBe("POST");
    expect(epDecoded.resource_type.value).toBe("api");

    // flow_point
    const fpSvcRef = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];
    const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
      svc_ref: fpSvcRef, flow_name: "checkout", flow_step: "success", flow_variant: "default",
    });
    const fpDecoded = decodePrefix(DEMO_CATALOG, "flow_point", "v1", fpAddr);
    expect(fpDecoded.flow_name.value).toBe("checkout");
    expect(fpDecoded.flow_step.value).toBe("success");
  });

  it("4. resolve — 자동 마이그레이션 (v1 → v2 migration)", () => {
    const pvRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
    const addr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
      svc_ref: pvRef, page: "checkout", locale: "ko", userType: "member",
    });
    const serialized = `page_view:v1:${addr}`;

    const result = resolve(DEMO_CATALOG, serialized);
    // page_view v2가 최신이므로 v1 주소는 migration 발생
    expect(result.migrated).toBe(true);
    expect(result.values.page.value).toBe("checkout");
  });

  it("5. DKG 영향 분석 — flow_name 축 변경 cascade", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    const impact = analyzeImpact(graph, {
      type: "entry-added",
      target: { axis: "flow_name" },
      detail: "새 흐름 추가",
    });

    expect(impact.strideBreak).toBe(false);
    // flow_point prefix가 영향받음
    expect(impact.affectedPrefixes.some(p => p.id === "flow_point")).toBe(true);
    // observation-domain이 영향받음
    expect(impact.affectedDomains.some(d => d.id === "observation-domain")).toBe(true);
  });

  it("6. DKG IntentLink — checkout-flow 연결 확인", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    const links = graph.intentLinksFor("flow_point");
    expect(links.some(l => l.id === "IL-checkout-flow")).toBe(true);
    expect(links[0].invariant).toContain("checkout");
  });

  it("7. 전체 시스템 현황 — self-evaluation", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    const axes = graph.getNodesByKind("axis");
    const prefixes = graph.getNodesByKind("prefix");
    const domains = graph.getNodesByKind("domain");
    const consumers = graph.getNodesByKind("consumer");
    const intentLinks = graph.getNodesByKind("intent-link");

    // catalog/config에서 파생 — 하드코딩 금지
    const catalogAxisCount = Object.keys(DEMO_CATALOG.axes).length;
    const catalogPrefixCount = Object.keys(DEMO_CATALOG.prefixes).length;
    const configDomainCount = DEMO_DKG_CONFIG.domains.length;
    const configConsumerCount = DEMO_DKG_CONFIG.consumers.length;
    const configConstraintCount = DEMO_DKG_CONFIG.constraints.length;
    const configDslCount = DEMO_DKG_CONFIG.dslBundles.length;

    // DKG bootstrap가 catalog의 모든 엔티티를 등록했는지 검증
    expect(axes.length).toBe(catalogAxisCount);
    expect(prefixes.length).toBe(catalogPrefixCount);
    expect(domains.length).toBe(configDomainCount);
    expect(consumers.length).toBe(configConsumerCount);
    expect(intentLinks.length).toBe(DEMO_DKG_CONFIG.intentLinks?.length ?? intentLinks.length);
    const dslBundles = graph.getNodesByKind("dsl-bundle");
    expect(dslBundles.length).toBe(configDslCount);
    // constraint: config 정의 + bootstrap 자동 생성분
    const constraints = graph.getNodesByKind("constraint");
    expect(constraints.length).toBeGreaterThanOrEqual(configConstraintCount);
    // observation, decision: bootstrap 로직이 자동 생성 — 최소값 검증
    const observations = graph.getNodesByKind("observation");
    expect(observations.length).toBeGreaterThan(0);
    const decisions = graph.getNodesByKind("decision");
    expect(decisions.length).toBeGreaterThan(0);
    // Skew Observation → Decision prompts 엣지 확인 (coverage obs 제외)
    const skewObs = observations.filter(o => (o as any).id?.includes("SKEW"));
    for (const obs of skewObs) {
      const prompted = graph.neighbors(obs.id, "prompts");
      expect(prompted.length).toBe(1);
    }
  });
});
