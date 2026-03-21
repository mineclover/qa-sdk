import { describe, it, expect } from "vitest";
import {
  buildServiceContainers, applyFilters, computeScopeLayouts, filterContainer,
  DEMO_SERVICES, ENV_FILTERS,
  type PrefixInfo, type DataEntry,
} from "./service-scope.js";

const MOCK_PREFIX_INFOS = new Map<string, PrefixInfo>([
  ["page_view", { id: "page_view", category: "observation", entries: ["home", "product", "cart", "checkout"], pattern: "grid" }],
  ["tracking", { id: "tracking", category: "entity", entries: ["click", "view", "submit"], pattern: "row" }],
  ["endpoint", { id: "endpoint", category: "observation", entries: ["GET/api", "POST/api"], pattern: "row" }],
  ["flow_point", { id: "flow_point", category: "observation", entries: ["checkout/entry", "checkout/success"], pattern: "shelf" }],
  ["permission", { id: "permission", category: "policy", entries: ["admin", "customer"], pattern: "row" }],
  ["cart_event", { id: "cart_event", category: "event", entries: ["add", "remove"], pattern: "row" }],
  ["order_event", { id: "order_event", category: "event", entries: ["create", "complete"], pattern: "row" }],
  ["auth_event", { id: "auth_event", category: "event", entries: ["login", "logout"], pattern: "row" }],
  ["service", { id: "service", category: "entity", entries: ["web", "backend", "auth", "payment"], pattern: "row" }],
  ["deploy_event", { id: "deploy_event", category: "event", entries: ["deploy", "rollback"], pattern: "row" }],
  ["health_event", { id: "health_event", category: "event", entries: ["healthy", "degraded"], pattern: "row" }],
  ["pipeline_point", { id: "pipeline_point", category: "observation", entries: ["ingest", "verdict"], pattern: "row" }],
  ["data_policy", { id: "data_policy", category: "observation", entries: ["raw", "mask"], pattern: "row" }],
  ["event", { id: "event", category: "entity", entries: ["user.login", "order.created"], pattern: "row" }],
]);

const MOCK_TABLE_COLS: Record<string, DataEntry[]> = {
  members: [
    { table: "members", column: "id", refKind: "scalar" },
    { table: "members", column: "role", refKind: "axis_ref" },
  ],
  orders: [
    { table: "orders", column: "id", refKind: "scalar" },
    { table: "orders", column: "status", refKind: "axis_ref" },
    { table: "orders", column: "amount", refKind: "scalar" },
  ],
};

describe("ServiceScope — 서비스 중심 계층 뷰", () => {

  it("서비스별 컨테이너 생성 — tier 분류", () => {
    const containers = buildServiceContainers(DEMO_SERVICES, MOCK_PREFIX_INFOS, MOCK_TABLE_COLS);

    expect(containers.length).toBe(5);

    // shopping-web: T0(page_view, tracking), T1(endpoint, flow_point, permission, service)
    const web = containers.find(c => c.serviceId === "shopping-web")!;
    expect(web.tiers[0].length).toBe(2); // page_view, tracking
    expect(web.tiers[1].length).toBeGreaterThanOrEqual(2); // endpoint, flow_point, ...
    expect(web.dataEntries.length).toBe(2); // members 테이블

    // shopping-backend: T2(cart_event, order_event, event), T1(permission, endpoint, service)
    const be = containers.find(c => c.serviceId === "shopping-backend")!;
    expect(be.tiers[2].length).toBeGreaterThanOrEqual(2); // cart_event, order_event, event

    console.log("\n══ ServiceScope 계층 ══");
    for (const c of containers) {
      console.log(`\n  ${c.serviceId} (${c.serviceName})`);
      for (const tier of [0, 1, 2, 3] as const) {
        if (c.tiers[tier].length > 0) {
          console.log(`    T${tier}: ${c.tiers[tier].map(t => `${t.prefixId}[${t.pattern}]`).join(", ")}`);
        }
      }
      if (c.dataEntries.length > 0) {
        console.log(`    Data: ${c.dataEntries.map(d => `${d.table}.${d.column}`).join(", ")}`);
      }
    }
  });

  it("env 필터 — prod만 표시", () => {
    const entries = ["dev", "stage", "prod", "test", "local"];
    const filtered = applyFilters(entries, "env", [ENV_FILTERS.prodOnly]);
    expect(filtered).toEqual(["prod"]);
  });

  it("env 필터 — test/local 숨기기", () => {
    const entries = ["dev", "stage", "prod", "test", "local"];
    const filtered = applyFilters(entries, "env", [ENV_FILTERS.hideTest]);
    expect(filtered).toEqual(["dev", "stage", "prod"]);
  });

  it("필터 미적용 축 → 원본 유지", () => {
    const entries = ["admin", "customer"];
    const filtered = applyFilters(entries, "role", [ENV_FILTERS.prodOnly]);
    expect(filtered).toEqual(["admin", "customer"]); // role은 필터 대상 아님
  });

  it("레이아웃 계산 — 서비스별 위치", () => {
    const containers = buildServiceContainers(DEMO_SERVICES, MOCK_PREFIX_INFOS);
    const layouts = computeScopeLayouts(containers);

    expect(layouts.length).toBe(5);

    // 서비스 간 간격 확인
    const xs = layouts.map(l => l.position.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThan(0); // 양수 간격
    }

    console.log("\n══ 레이아웃 ══");
    for (const l of layouts) {
      console.log(`  ${l.serviceId}: pos=(${l.position.x},${l.position.y}) size=${l.size.width}×${l.size.height}`);
    }
  });
});
