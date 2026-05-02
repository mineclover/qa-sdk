// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { buildFullLineageChain } from "./lineage-chain.js";
import { FacetCodeRegistry } from "./facet-code-registry.js";
import { BindingRegistry } from "./registry.js";
import { LineageCollector } from "../pipe/data-contract.js";
import type { FieldRef } from "../types/data-schema.js";

describe("buildFullLineageChain", () => {
  it("3단 체인 조립 — 코드 + 패싯 + 바인딩 모두 연결", () => {
    // 계보: orderId → validatedOrder → paymentResult
    const collector = new LineageCollector();
    collector.record({
      target: { schemaId: "payments", column: "paymentResult" },
      sources: [{ schemaId: "orders", column: "validatedOrder" }],
      transform: "compute",
      pipeId: "p1",
      stepPath: "flow.steps[1]",
      facet: "결제처리",
    });
    collector.record({
      target: { schemaId: "orders", column: "validatedOrder" },
      sources: [{ schemaId: "orders", column: "orderId" }],
      transform: "compute",
      pipeId: "p1",
      stepPath: "flow.steps[0]",
      facet: "주문검증",
    });

    // 패싯-코드 매핑
    const facetReg = new FacetCodeRegistry();
    facetReg.register({
      facet: "결제처리",
      implementations: [{ file: "payment/process.ts", symbol: "processPayment" }],
      schemaId: "payments",
    });
    facetReg.register({
      facet: "주문검증",
      implementations: [{ file: "order/validate.ts", symbol: "validateOrder" }],
      schemaId: "orders",
    });

    // 좌표 바인딩
    const bindingReg = new BindingRegistry();
    bindingReg.register({
      schemaId: "orders",
      schemaVersion: "v1",
      prefixId: "order_event",
      prefixVersion: "v1",
      columnToAxis: { orderId: { dimLabel: "order" } },
    });
    bindingReg.register({
      schemaId: "payments",
      schemaVersion: "v1",
      prefixId: "payment_event",
      prefixVersion: "v1",
      columnToAxis: { paymentId: { dimLabel: "payment" } },
    });

    const target: FieldRef = { schemaId: "payments", column: "paymentResult" };
    const chain = buildFullLineageChain(target, collector, facetReg, bindingReg);

    // target 노드
    expect(chain.target.field).toEqual(target);
    expect(chain.target.binding).not.toBeUndefined();
    expect(chain.target.binding!.prefixId).toBe("payment_event");

    // source 노드들
    expect(chain.sources.length).toBeGreaterThanOrEqual(1);
    const orderSource = chain.sources.find(s => s.field.schemaId === "orders");
    expect(orderSource).toBeDefined();
    expect(orderSource!.binding).not.toBeUndefined();
    expect(orderSource!.binding!.prefixId).toBe("order_event");

    // quality — 전부 연결됨
    expect(chain.quality.bound).toBeGreaterThan(0);
    expect(chain.quality.mapped).toBeGreaterThan(0);
  });

  it("미매핑 패싯/미바인딩 스키마 → quality에 반영", () => {
    const collector = new LineageCollector();
    collector.record({
      target: { schemaId: "output", column: "result" },
      sources: [{ schemaId: "input", column: "raw" }],
      transform: "compute",
      pipeId: "p1",
      stepPath: "flow",
      facet: "미등록패싯",
    });

    const facetReg = new FacetCodeRegistry();
    // 패싯 미등록

    const bindingReg = new BindingRegistry();
    // 바인딩 미등록

    const chain = buildFullLineageChain(
      { schemaId: "output", column: "result" },
      collector,
      facetReg,
      bindingReg,
    );

    // 모두 unbound
    expect(chain.quality.unbound).toBe(2); // target + source
    expect(chain.quality.bound).toBe(0);

    // 패싯은 있지만 매핑 없음
    expect(chain.quality.unmapped).toBeGreaterThan(0);
    expect(chain.quality.mapped).toBe(0);
  });

  it("패싯 없는 계보 → quality.unmapped에 미포함", () => {
    const collector = new LineageCollector();
    collector.record({
      target: { schemaId: "out", column: "x" },
      sources: [{ schemaId: "in", column: "y" }],
      transform: "direct",
      pipeId: "p1",
      stepPath: "flow",
      // facet 없음
    });

    const chain = buildFullLineageChain(
      { schemaId: "out", column: "x" },
      collector,
      new FacetCodeRegistry(),
      new BindingRegistry(),
    );

    // 패싯 없는 노드는 mapped/unmapped에 포함되지 않음
    expect(chain.quality.mapped).toBe(0);
    expect(chain.quality.unmapped).toBe(0);
  });
});
