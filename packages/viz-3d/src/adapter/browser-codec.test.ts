import { describe, it, expect } from "vitest";
import { encode, decode, track, decodeContext, trackWithSignal } from "./browser-codec.js";
import { BROWSER_CATALOG } from "./demo-catalog-browser.js";

describe("BrowserCodec — 경량 encode/decode", () => {

  it("encode: page_view → serialized", () => {
    const result = encode(BROWSER_CATALOG, "page_view", {
      svc_ref: 65536, page: "checkout", locale: "ko", userType: "member",
    });
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe("page_view");
    expect(result!.version).toBe("v2");
    expect(result!.serialized).toMatch(/^page_view:v2:\d+$/);
  });

  it("decode: serialized → values", () => {
    const enc = encode(BROWSER_CATALOG, "page_view", {
      svc_ref: 65536, page: "checkout", locale: "ko", userType: "member",
    })!;
    const dec = decode(BROWSER_CATALOG, enc.serialized);
    expect(dec).not.toBeNull();
    expect(dec!.values.page).toBe("checkout");
    expect(dec!.values.locale).toBe("ko");
    expect(dec!.values.userType).toBe("member");
  });

  it("encode → decode 라운드트립", () => {
    const values = { svc_ref: 65536, page: "home", locale: "en", userType: "premium" };
    const enc = encode(BROWSER_CATALOG, "page_view", values)!;
    const dec = decode(BROWSER_CATALOG, enc.serialized)!;
    expect(dec.values.page).toBe("home");
    expect(dec.values.locale).toBe("en");
    expect(dec.values.userType).toBe("premium");
  });

  it("track: 여러 prefix 동시 encode + svc_ref 자동 주입", () => {
    const ctx = track(BROWSER_CATALOG, {
      page_view: { page: "checkout", locale: "ko", userType: "member" },
      endpoint: { resource_type: "api", http_method: "POST", api_version: "v1" },
      cart_event: { action: "add" },
    });

    expect(ctx.page_view).toMatch(/^page_view:v2:\d+$/);
    expect(ctx.endpoint).toMatch(/^endpoint:v1:\d+$/);
    expect(ctx.cart_event).toMatch(/^cart_event:v1:\d+$/);
    // svc_ref 자동 주입됨
  });

  it("decodeContext: address_context 전체 decode", () => {
    const ctx = track(BROWSER_CATALOG, {
      page_view: { page: "home", locale: "ko", userType: "guest" },
      tracking: { trackAction: "view", page: "home", userType: "guest" },
    });

    const decoded = decodeContext(BROWSER_CATALOG, ctx);
    expect(decoded.page_view.values.page).toBe("home");
    expect(decoded.tracking.values.trackAction).toBe("view");
  });

  it("trackWithSignal: encode + role 분류", () => {
    const result = trackWithSignal(BROWSER_CATALOG, {
      page_view: { page: "checkout", locale: "ko", userType: "member" },
      tracking: { trackAction: "navigate", page: "checkout", userType: "member" },
      endpoint: { resource_type: "api", http_method: "POST", api_version: "v1" },
      flow_point: { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
      permission: { role: "customer" },
    });

    expect(Object.keys(result.addressContext).length).toBe(5);

    // role 분류 검증
    expect(result.byRole.context.length).toBe(1);  // page_view
    expect(result.byRole.trigger.length).toBe(1);   // tracking
    expect(result.byRole.channel.length).toBe(1);   // endpoint
    expect(result.byRole.state.length).toBe(1);     // flow_point
    expect(result.byRole.guard.length).toBe(1);     // permission
  });

  it("encode 실패: 없는 entry", () => {
    const result = encode(BROWSER_CATALOG, "page_view", {
      page: "nonexistent", locale: "ko", userType: "member",
    });
    expect(result).toBeNull();
  });

  it("decode 실패: 잘못된 형식", () => {
    expect(decode(BROWSER_CATALOG, "bad-format")).toBeNull();
    expect(decode(BROWSER_CATALOG, "unknown_prefix:v1:0")).toBeNull();
  });

  it("BROWSER_CATALOG에 모든 주요 prefix 존재", () => {
    const expected = ["service", "page_view", "tracking", "endpoint", "flow_point",
      "cart_event", "auth_event", "order_event", "permission",
      "deploy_event", "health_event", "pipeline_point", "data_policy"];
    for (const p of expected) {
      expect(BROWSER_CATALOG[p]).toBeDefined();
    }
  });
});
