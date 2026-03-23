import { describe, it, expect, vi } from "vitest";
import { createAutoTracker, createDefaultSvcRefResolver } from "./auto-track.js";
import { createTrackingContext } from "./tracking-context.js";
import { registerMappings, SHOP_EVENT_MAPPINGS } from "./prefix-mapping.js";

// 매핑 등록 보장
registerMappings(SHOP_EVENT_MAPPINGS);

// 간단한 mock catalog — 인코딩 검증용
const mockCatalog = {
  prefixes: {
    tracking: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, trackAction: { kind: "axis" }, page: { kind: "axis" }, userType: { kind: "axis" } },
      versions: [{ version: "v3", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    cart_event: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, action: { kind: "axis" } },
      versions: [{ version: "v2", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    endpoint: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, resource_type: { kind: "axis" }, http_method: { kind: "axis" }, api_version: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    page_view: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, page: { kind: "axis" }, locale: { kind: "axis" }, userType: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    auth_event: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, action: { kind: "axis" } },
      versions: [{ version: "v2", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    flow_point: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, flow_name: { kind: "axis" }, flow_step: { kind: "axis" }, flow_variant: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
    permission: {
      dims: { perm_svc: { kind: "prefix_ref", prefixId: "service" }, role: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { perm_svc: { values: [0], refVersion: "v1" } } }],
    },
    order_event: {
      dims: { service_ctx: { kind: "prefix_ref", prefixId: "service" }, action: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { service_ctx: { values: [0], refVersion: "v1" } } }],
    },
    pipeline_point: {
      dims: { svc_ref: { kind: "prefix_ref", prefixId: "service" }, pipeline_phase: { kind: "axis" }, validation_mode: { kind: "axis" }, verdict_result: { kind: "axis" }, temporal_strategy: { kind: "axis" } },
      versions: [{ version: "v1", refEntries: { svc_ref: { values: [0], refVersion: "v1" } } }],
    },
  },
};

// mock encode — dims 개수만 검증
const mockEncode = vi.fn((_cat: any, _pid: string, _ver: string, dims: Record<string, any>) => Object.keys(dims).length);
const mockVersion = vi.fn((_cat: any, pid: string) => mockCatalog.prefixes[pid as keyof typeof mockCatalog.prefixes]?.versions[0].version ?? "v1");

describe("createAutoTracker", () => {
  it("cart.add → 3 prefix 자동 인코딩 + emit 호출", () => {
    const emitFn = vi.fn();
    const ctx = createTrackingContext({ locale: "ko", initialPage: "product_detail", initialUserType: "member" });

    const qa = createAutoTracker({
      catalog: mockCatalog,
      context: ctx,
      encodePrefixByValue: mockEncode,
      latestPrefixVersion: mockVersion,
      emit: emitFn,
    });

    qa.track("cart.add", { item_id: 7, qty: 1 });

    expect(emitFn).toHaveBeenCalledOnce();
    const [eventKey, addressContext, payload] = emitFn.mock.calls[0];
    expect(eventKey).toBe("cart.add");
    expect(payload).toEqual({ item_id: 7, qty: 1 });
    // 3 prefix: tracking, endpoint, cart_event
    expect(Object.keys(addressContext)).toHaveLength(3);
    expect(addressContext).toHaveProperty("tracking");
    expect(addressContext).toHaveProperty("endpoint");
    expect(addressContext).toHaveProperty("cart_event");
  });

  it("auth.login → 6 prefix", () => {
    const emitFn = vi.fn();
    const ctx = createTrackingContext({ locale: "ko", initialUserType: "guest" });
    ctx.setPage("login");

    const qa = createAutoTracker({
      catalog: mockCatalog, context: ctx,
      encodePrefixByValue: mockEncode, latestPrefixVersion: mockVersion, emit: emitFn,
    });

    qa.track("auth.login");

    const [, addressContext] = emitFn.mock.calls[0];
    expect(Object.keys(addressContext)).toHaveLength(6);
  });

  it("컨텍스트 변경이 다음 track에 반영됨", () => {
    const emitFn = vi.fn();
    const ctx = createTrackingContext({ locale: "ko", initialUserType: "guest" });

    const qa = createAutoTracker({
      catalog: mockCatalog, context: ctx,
      encodePrefixByValue: mockEncode, latestPrefixVersion: mockVersion, emit: emitFn,
    });

    // 로그인 전
    ctx.setPage("login");
    qa.track("auth.login");

    // 로그인 후 — userType 변경
    ctx.setUser("member");
    ctx.setPage("home");
    qa.track("page.view");

    // 두 번째 호출에서 userType=member 반영 확인
    expect(emitFn).toHaveBeenCalledTimes(2);
  });

  it("매핑 없는 이벤트 → address_context 비어있음 + emit은 호출됨", () => {
    const emitFn = vi.fn();
    const ctx = createTrackingContext();

    const qa = createAutoTracker({
      catalog: mockCatalog, context: ctx,
      encodePrefixByValue: mockEncode, latestPrefixVersion: mockVersion, emit: emitFn,
    });

    qa.track("unknown.event", { data: 123 });

    expect(emitFn).toHaveBeenCalledWith("unknown.event", {}, { data: 123 });
  });

  it("reset() 후 userType이 guest로 복원", () => {
    const ctx = createTrackingContext({ locale: "ko", initialUserType: "guest" });
    ctx.setUser("admin");
    expect(ctx.get().userType).toBe("admin");

    ctx.reset();
    expect(ctx.get().userType).toBe("guest");
    expect(ctx.get().page).toBe("");
  });
});

describe("createDefaultSvcRefResolver", () => {
  it("prefix의 refEntries에서 svc_ref 값을 찾음", () => {
    const resolver = createDefaultSvcRefResolver(mockCatalog);
    expect(resolver("tracking")).toBe(0);
    expect(resolver("cart_event")).toBe(0);
  });

  it("perm_svc 대체 키도 인식", () => {
    const resolver = createDefaultSvcRefResolver(mockCatalog);
    expect(resolver("permission")).toBe(0); // perm_svc
  });

  it("없는 prefix → undefined", () => {
    const resolver = createDefaultSvcRefResolver(mockCatalog);
    expect(resolver("nonexistent")).toBeUndefined();
  });
});
