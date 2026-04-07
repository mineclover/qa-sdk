import { describe, it, expect } from "vitest";
import { resolvePrefixDims, getMapping, getAllMappings, getAllPacks, getPack, getPacksForEvent, SHOP_EVENT_MAPPINGS } from "./prefix-mapping.js";
import type { TrackingContext } from "./prefix-mapping.js";

const memberCtx: TrackingContext = { page: "product_detail", userType: "member", locale: "ko" };
const guestCtx: TrackingContext = { page: "login", userType: "guest", locale: "ko" };

describe("prefix-mapping", () => {
  describe("resolvePrefixDims", () => {
    it("cart.add → tracking + endpoint + cart_event (3 prefix)", () => {
      const mapping = getMapping("cart.add")!;
      expect(mapping).toBeDefined();

      const dims = resolvePrefixDims(mapping, memberCtx);

      expect(dims.tracking).toEqual({
        trackAction: "add_to_cart",
        page: "product_detail",
        userType: "member",
      });
      expect(dims.endpoint).toEqual({
        resource_type: "api",
        http_method: "POST",
        api_version: "v1",
      });
      expect(dims.cart_event).toEqual({ action: "add" });
      expect(Object.keys(dims)).toHaveLength(3);
    });

    it("auth.login → 6개 prefix (page_view + tracking + auth_event + endpoint + flow_point + permission)", () => {
      const mapping = getMapping("auth.login")!;
      const dims = resolvePrefixDims(mapping, guestCtx);

      expect(Object.keys(dims)).toHaveLength(6);
      expect(dims.page_view.page).toBe("login");
      expect(dims.auth_event.action).toBe("login");
      expect(dims.flow_point.flow_name).toBe("login");
      expect(dims.permission.role).toBe("customer");
    });

    it("page.view → page_view + tracking (컨텍스트에서 page 파생)", () => {
      const mapping = getMapping("page.view")!;
      const dims = resolvePrefixDims(mapping, { page: "home", userType: "member", locale: "ko" });

      expect(dims.page_view.page).toBe("home");
      expect(dims.tracking.page).toBe("home");
      expect(dims.tracking.trackAction).toBe("view");
    });

    it("checkout.process → 6개 prefix (order_event 포함)", () => {
      const mapping = getMapping("checkout.process")!;
      const dims = resolvePrefixDims(mapping, memberCtx);

      expect(dims.order_event).toEqual({ action: "create" });
      expect(dims.flow_point.flow_step).toBe("processing");
    });

    it("payment.success → pipeline_point 포함", () => {
      const mapping = getMapping("payment.success")!;
      const dims = resolvePrefixDims(mapping, memberCtx);

      expect(dims.pipeline_point.pipeline_phase).toBe("verdict");
      expect(dims.order_event.action).toBe("complete");
    });

    it("컨텍스트 없으면 해당 prefix 스킵 (page_view 필수 필드 없을 때)", () => {
      const mapping = getMapping("page.view")!;
      // page 없는 컨텍스트
      const dims = resolvePrefixDims(mapping, { userType: "member" });

      // page_view에 page가 필수인데 없으므로 스킵
      expect(dims.page_view).toBeUndefined();
      // tracking에도 page가 필수
      expect(dims.tracking).toBeUndefined();
    });
  });

  describe("registry", () => {
    it("SHOP_EVENT_MAPPINGS에 11개 이벤트 정의", () => {
      expect(SHOP_EVENT_MAPPINGS.length).toBe(11);
    });

    it("getAllMappings()로 등록된 매핑 조회", () => {
      const all = getAllMappings();
      expect(all.length).toBeGreaterThanOrEqual(11);
    });

    it("pack registry로 등록된 pack 목록을 조회한다", () => {
      const packs = getAllPacks();
      expect(packs.length).toBeGreaterThanOrEqual(5);
      expect(packs.map((pack) => pack.packId)).toContain("shop-pack");
      expect(getPack("shop-pack")?.owner).toBe("shopping-web");
      expect(getPack("shop-pack")?.version).toBe("v1");
      expect(getPack("shop-pack")?.status).toBe("active");
    });

    it("event_key로 소속 pack을 역조회한다", () => {
      expect(getPacksForEvent("page.view")).toContain("shop-pack");
      expect(getPacksForEvent("harness.transition")).toContain("harness-pack");
    });

    it("모든 매핑의 prefixes가 비어있지 않음", () => {
      for (const m of getAllMappings()) {
        expect(m.prefixes.length).toBeGreaterThan(0);
      }
    });

    it("모든 매핑에 domain이 있음", () => {
      for (const m of getAllMappings()) {
        expect(m.domain).toBeTruthy();
      }
    });
  });

  describe("SDK 수준 사용 시뮬레이션", () => {
    it("개발자가 event_key + payload만 넘기면 prefix dims 자동 생성", () => {
      // 개발자 코드:
      const eventKey = "cart.add";
      const payload = { item_id: 7, qty: 1 };
      const context: TrackingContext = { page: "product_detail", userType: "member", locale: "ko" };

      // SDK 내부:
      const mapping = getMapping(eventKey);
      expect(mapping).toBeDefined();
      const prefixDims = resolvePrefixDims(mapping!, context, payload);

      // 결과: 개발자가 일일이 지정하지 않아도 3개 prefix 자동 생성
      expect(Object.keys(prefixDims).toSorted()).toEqual(["cart_event", "endpoint", "tracking"]);
      expect(prefixDims.cart_event.action).toBe("add");
    });
  });
});
