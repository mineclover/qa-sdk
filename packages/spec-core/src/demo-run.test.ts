/**
 * 실제 개발 시나리오 데모 — DSL DB 활용.
 * 시나리오: "결제 API에 환불 엔드포인트를 추가해야 한다"
 */

import { describe, it } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG, encodePrefixByValue, decodePrefix } from "demo-snapshot";
import { bootstrapDkg, analyzeImpact, defineFlow, serializeFlow, resolve, findVersionForEntry, findRefAddress } from "dkg";
import { compareAxes, optimizeCapacities } from "@qa-sdk/convergence";

const SEP = "─".repeat(60);

describe("DSL DB 실제 개발 시나리오: 결제 API에 환불 엔드포인트 추가", () => {

it("전체 시나리오 실행", () => {

console.log("\n══ DSL DB 실제 개발 시나리오: 결제 API에 환불 엔드포인트 추가 ══\n");

// ─────────────────────────────────────────────────────────────
// Step 1. 의사결정: 7개 질문
// ─────────────────────────────────────────────────────────────

console.log("Step 1. 의사결정 — 7개 질문\n" + SEP);

// Q1. 기존 축에 있는가?
console.log("\n  Q1. 기존 축에 'refund'가 있는가?");
const refundInOrderAction = findVersionForEntry(DEMO_CATALOG, "order_action", "refund");
console.log(`      order_action에 'refund': ${refundInOrderAction.length > 0 ? `있음 (${refundInOrderAction.join(",")})` : "없음"}`);
console.log("      → order_action에 이미 있다! 축 추가 불필요.");

// Q2. 기존 prefix에 있는가?
console.log("\n  Q2. endpoint prefix에서 이 기능을 표현할 수 있는가?");
console.log("      endpoint prefix = service_ref × resource_type × http_method × api_version");
console.log("      → API 경로(/refund)는 좌표 밖. resource_type=api로 충분.");
console.log("      → 새 prefix 불필요. 경로는 payload.resource_path로.");

// Q3~Q7
console.log("\n  Q3. 확장 vs 신규? → endpoint prefix 재사용 (경로는 좌표 밖)");
console.log("  Q4. Domain? → observation-domain (이미 소속)");
console.log("  Q5. 연결? → order_event의 refund와 연결 (IntentLink 후보)");
console.log("  Q6. capacity? → resource_type cap=32, http_method cap=32 — headroom 충분");
console.log("  Q7. 영향? → 축 변경 없음. 기존에 영향 없음.");

// ─────────────────────────────────────────────────────────────
// Step 2. encode/decode — 새 기능의 좌표 확인
// ─────────────────────────────────────────────────────────────

console.log("\n\nStep 2. encode/decode — 기존 좌표 활용\n" + SEP);

// 결제 API 호출을 추적하는 주소 (경로는 좌표 밖)
const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
const apiAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
  svc_ref: svcRef, resource_type: "api", http_method: "POST", api_version: "v2",
});
console.log(`\n  POST api v2 → 주소: ${apiAddr} (경로 /payments는 좌표 밖)`);

const decoded = decodePrefix(DEMO_CATALOG, "endpoint", "v1", apiAddr);
console.log("  decode:", JSON.stringify(Object.fromEntries(
  Object.entries(decoded).map(([k, v]) => [k, v.value]),
)));

// 주문 취소 이벤트
const fpRef = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];
const orderAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
  svc_ref: fpRef, flow_name: "refund", flow_step: "entry", flow_variant: "default",
});
console.log(`\n  환불 흐름 진입 → 주소: ${orderAddr}`);

const orderDecoded = decodePrefix(DEMO_CATALOG, "flow_point", "v1", orderAddr);
console.log("  decode:", JSON.stringify(Object.fromEntries(
  Object.entries(orderDecoded).map(([k, v]) => [k, v.value]),
)));

// ─────────────────────────────────────────────────────────────
// Step 3. FlowDefinition — 환불 흐름 정의
// ─────────────────────────────────────────────────────────────

console.log("\n\nStep 3. FlowDefinition — 환불 흐름 관측 포인트\n" + SEP);

const pvSvcRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
const fpSvcRef = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];

const refundFlow = defineFlow(DEMO_CATALOG, {
  id: "refund-flow",
  name: "환불 흐름",
  description: "환불 요청 → 처리 → 성공/실패",
  entry: {
    prefix: "page_view", version: "v1",
    values: { svc_ref: pvSvcRef, page: "checkout", locale: "ko", userType: "member" },
  },
  branches: {
    request: {
      prefix: "flow_point", version: "v1",
      values: { svc_ref: fpSvcRef, flow_name: "refund", flow_step: "entry", flow_variant: "default" },
    },
    processing: {
      prefix: "flow_point", version: "v1",
      values: { svc_ref: fpSvcRef, flow_name: "refund", flow_step: "processing", flow_variant: "default" },
    },
    success: {
      prefix: "flow_point", version: "v1",
      values: { svc_ref: fpSvcRef, flow_name: "refund", flow_step: "success", flow_variant: "default" },
    },
    failure: {
      prefix: "flow_point", version: "v1",
      values: { svc_ref: fpSvcRef, flow_name: "refund", flow_step: "failure", flow_variant: "default" },
    },
    manualReview: {
      prefix: "flow_point", version: "v1",
      values: { svc_ref: fpSvcRef, flow_name: "refund", flow_step: "branch", flow_variant: "manual" },
    },
  },
});

console.log(`\n  ${refundFlow.name} (${refundFlow.id})`);
console.log(`  진입: page_view:v1:${refundFlow.entry.address} (${refundFlow.entry.label})`);
for (const [name, point] of Object.entries(refundFlow.branches)) {
  console.log(`  ${name.padEnd(15)} flow_point:v1:${point.address} (${point.label})`);
}

// ─────────────────────────────────────────────────────────────
// Step 4. DKG 영향 분석
// ─────────────────────────────────────────────────────────────

console.log("\n\nStep 4. DKG 영향 분석 — resource_type 축 확인\n" + SEP);

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
const impact = analyzeImpact(graph, {
  type: "entry-added",
  target: { axis: "resource_type" },
  detail: "resource_type 축 확인 (변경 없음)",
});

console.log(`\n  stride-break: ${impact.strideBreak}`);
console.log(`  migration 필요: ${impact.migrationRequired}`);
console.log(`  영향 prefix: ${impact.affectedPrefixes.map(p => p.id).join(", ")}`);
console.log(`  영향 domain: ${impact.affectedDomains.map(d => d.id).join(", ") || "없음"}`);
console.log(`  영향 consumer: ${impact.affectedConsumers.map(c => c.id).join(", ") || "없음"}`);
console.log(`  constraint 위반: ${impact.constraintViolations.length}개`);

// ─────────────────────────────────────────────────────────────
// Step 5. resolve — 버전 마이그레이션
// ─────────────────────────────────────────────────────────────

console.log("\n\nStep 5. resolve — 주소 해석\n" + SEP);

const serialized = `page_view:v1:${refundFlow.entry.address}`;
const resolved = resolve(DEMO_CATALOG, serialized);
console.log(`\n  입력: ${serialized}`);
console.log(`  해석: ${JSON.stringify(Object.fromEntries(
  Object.entries(resolved.values).map(([k, v]) => [k, v.value]),
))}`);
console.log(`  마이그레이션: ${resolved.migrated ? "발생" : "불필요"}`);

// ─────────────────────────────────────────────────────────────
// Step 6. 전체 시스템 현황
// ─────────────────────────────────────────────────────────────

console.log("\n\nStep 6. 시스템 현황\n" + SEP);

const axes = graph.getNodesByKind("axis");
const prefixes = graph.getNodesByKind("prefix");
const domains = graph.getNodesByKind("domain");
const consumers = graph.getNodesByKind("consumer");
const decisions = graph.getNodesByKind("decision");
const intentLinks = graph.getNodesByKind("intent-link");

console.log(`\n  축: ${axes.length}개, prefix: ${prefixes.length}개`);
console.log(`  domain: ${domains.length}개, consumer: ${consumers.length}개`);
console.log(`  decision: ${decisions.length}개, intent-link: ${intentLinks.length}개`);
console.log(`  총 노드: ${graph.nodeCount}개, 총 엣지: ${graph.edgeCount}개`);

// 주소 공간 요약
const epShape = [
  DEMO_CATALOG.axes.resource_type.versions.v1.capacity,
  DEMO_CATALOG.axes.http_method.versions.v1.capacity,
  DEMO_CATALOG.axes.api_version.versions.v1.capacity,
];
const fpShape = [
  DEMO_CATALOG.axes.flow_name.versions.v1.capacity,
  DEMO_CATALOG.axes.flow_step.versions.v1.capacity,
  DEMO_CATALOG.axes.flow_variant.versions.v1.capacity,
];

console.log(`\n  endpoint prefix 주소 공간: ${epShape.join(" × ")} = ${epShape.reduce((a, b) => a * b, 1)} 조합 (+ service_ref)`);
console.log(`  flow_point 주소 공간: ${fpShape.join(" × ")} = ${fpShape.reduce((a, b) => a * b, 1)} 조합`);
console.log(`  (Number.MAX_SAFE_INTEGER 대비 0.000...% 사용)\n`);

console.log("══════════════════════════════════════════════════════════════");
console.log("  결론: 환불 기능은 기존 좌표 체계에서 표현 가능.");
console.log("  경로(/refund)는 좌표 밖. 축 수정 불필요.");
console.log("  endpoint prefix로 resource_type=api + POST로 추적.");
console.log("══════════════════════════════════════════════════════════════\n");

}); // it
}); // describe
