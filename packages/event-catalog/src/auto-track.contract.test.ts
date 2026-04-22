// @def.boundary event-catalog
// @def.doc event-catalog

/**
 * Contract test — auto-track의 emit 결과가 AddressContextV1Schema에 부합하는지 검증.
 *
 * 핵심 검증:
 *   1. 정상 emit의 addressContext가 zod 스키마 통과
 *   2. 매핑 없는 이벤트는 빈 객체 → 스키마 통과
 *   3. dev 환경에서 schema 위반 시 throw
 */

import { AddressContextV1Schema } from "@qa-sdk/core/coordinates/address-context-schema";
import { describe, expect, it, vi } from "vitest";

import { createAutoTracker, type AutoTrackCatalog } from "./auto-track.js";
import { registerMappings, SHOP_EVENT_MAPPINGS } from "./prefix-mapping.js";
import { createTrackingContext } from "./tracking-context.js";

// 매핑 등록 보장
registerMappings(SHOP_EVENT_MAPPINGS);

// auto-track.test.ts와 동일한 mock catalog (실제 SHOP_EVENT_MAPPINGS의 prefix들)
const mockCatalog: AutoTrackCatalog = {
  prefixes: {
    tracking: {
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        trackAction: { kind: "axis" },
        page: { kind: "axis" },
        userType: { kind: "axis" },
      },
      versions: [{ version: "v3", refEntries: { svc_ref: { values: [0] } } }],
    },
    cart_event: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, action: { kind: "axis" } },
      versions: [{ version: "v2", refEntries: { svc_ref: { values: [0] } } }],
    },
    endpoint: {
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        resource_type: { kind: "axis" },
        http_method: { kind: "axis" },
        api_version: { kind: "axis" },
      },
      versions: [{ version: "v1", refEntries: { svc_ref: { values: [0] } } }],
    },
  },
};

const mockEncode = vi.fn(
  (_cat: AutoTrackCatalog, _pid: string, _ver: string, dims: Record<string, unknown>) =>
    Object.keys(dims).length,
);
const mockVersion = vi.fn(
  (_cat: AutoTrackCatalog, pid: string) =>
    mockCatalog.prefixes?.[pid]?.versions?.[0]?.version ?? "v1",
);

describe("auto-track — emit address_context contract", () => {
  it("정상 emit은 AddressContextV1Schema 통과", () => {
    const captured: Array<{ key: string; ctx: Record<string, string> }> = [];
    const ctx = createTrackingContext({ locale: "ko", initialPage: "product_detail", initialUserType: "member" });

    const tracker = createAutoTracker({
      catalog: mockCatalog,
      context: ctx,
      emit: (key, addressContext) => {
        captured.push({ key, ctx: addressContext });
      },
      encodePrefixByValue: mockEncode,
      latestPrefixVersion: mockVersion,
    });

    tracker.track("cart.add", { item_id: 7 });

    expect(captured).toHaveLength(1);
    expect(() => AddressContextV1Schema.parse(captured[0].ctx)).not.toThrow();
    // 모든 값이 prefix:version:address 포맷이어야 함
    for (const value of Object.values(captured[0].ctx)) {
      expect(value).toMatch(/^[^:]+:[^:]+:\d+$/);
    }
  });

  it("매핑 없는 이벤트 → 빈 컨텍스트, 검증 통과", () => {
    let received: Record<string, string> | null = null;
    const ctx = createTrackingContext();

    const tracker = createAutoTracker({
      catalog: mockCatalog,
      context: ctx,
      emit: (_, addressContext) => {
        received = addressContext;
      },
      encodePrefixByValue: mockEncode,
      latestPrefixVersion: mockVersion,
    });

    tracker.track("unknown_event", {});
    expect(received).toEqual({});
    expect(() => AddressContextV1Schema.parse(received!)).not.toThrow();
  });
});
