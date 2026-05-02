// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { ManifestRegistry } from "./version-manifest.js";

describe("ManifestRegistry", () => {
  describe("Prefix 라이프사이클", () => {
    it("prefix를 draft로 등록한다", () => {
      const reg = new ManifestRegistry();
      const p = reg.registerPrefix("order_event", "v1");
      expect(p.state).toBe("draft");
      expect(p.prefixId).toBe("order_event");
      expect(p.version).toBe("v1");
    });

    it("draft → released 전이", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      const p = reg.transitionPrefix("order_event", "v1", "released");
      expect(p.state).toBe("released");
      expect(p.releasedAt).toBeDefined();
    });

    it("released → active 전이", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      const p = reg.transitionPrefix("order_event", "v1", "active");
      expect(p.state).toBe("active");
      expect(p.activatedAt).toBeDefined();
    });

    it("active → deprecated는 대체 버전 있어야 가능", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.transitionPrefix("order_event", "v1", "active");

      // 대체 버전 없이 deprecated 시도 → 실패
      expect(() =>
        reg.transitionPrefix("order_event", "v1", "deprecated"),
      ).toThrow("대체 prefix 버전이 active 상태가 아님");

      // v2를 active로 만들면 v1 deprecated 가능
      reg.registerPrefix("order_event", "v2");
      reg.transitionPrefix("order_event", "v2", "released");
      reg.transitionPrefix("order_event", "v2", "active");
      const p = reg.transitionPrefix("order_event", "v1", "deprecated");
      expect(p.state).toBe("deprecated");
    });

    it("무효 전이는 에러", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      expect(() =>
        reg.transitionPrefix("order_event", "v1", "active"),
      ).toThrow("전이 불가");
    });

    it("중복 prefix 버전 등록 에러", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      expect(() => reg.registerPrefix("order_event", "v1")).toThrow("이미 존재");
    });
  });

  describe("Manifest 라이프사이클", () => {
    function setupPrefixes(reg: ManifestRegistry) {
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.registerPrefix("cart_event", "v1");
      reg.transitionPrefix("cart_event", "v1", "released");
    }

    it("매니페스트를 draft로 생성한다", () => {
      const reg = new ManifestRegistry();
      setupPrefixes(reg);

      const m = reg.createManifest("order-service", "v1", {
        order_event: "v1",
        cart_event: "v1",
      });
      expect(m.state).toBe("draft");
      expect(m.prefixes).toEqual({ order_event: "v1", cart_event: "v1" });
    });

    it("draft → published: 모든 prefix가 released 이상이면 성공", () => {
      const reg = new ManifestRegistry();
      setupPrefixes(reg);
      reg.createManifest("order-service", "v1", {
        order_event: "v1",
        cart_event: "v1",
      });

      const m = reg.transitionManifest("order-service", "v1", "published");
      expect(m.state).toBe("published");
    });

    it("draft → published: draft prefix가 포함되면 실패", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.registerPrefix("cart_event", "v1");
      // cart_event는 draft 상태

      reg.createManifest("order-service", "v1", {
        order_event: "v1",
        cart_event: "v1",
      });

      expect(() =>
        reg.transitionManifest("order-service", "v1", "published"),
      ).toThrow("draft 상태");
    });

    it("published → active: prefix도 자동 active 전이", () => {
      const reg = new ManifestRegistry();
      setupPrefixes(reg);
      reg.createManifest("order-service", "v1", {
        order_event: "v1",
        cart_event: "v1",
      });
      reg.transitionManifest("order-service", "v1", "published");
      reg.transitionManifest("order-service", "v1", "active");

      // prefix들이 자동으로 active됨
      expect(reg.getPrefixRecord("order_event", "v1").state).toBe("active");
      expect(reg.getPrefixRecord("cart_event", "v1").state).toBe("active");
    });

    it("새 매니페스트 active 시 이전 매니페스트는 superseded", () => {
      const reg = new ManifestRegistry();
      setupPrefixes(reg);

      // v1 매니페스트
      reg.createManifest("order-service", "v1", { order_event: "v1", cart_event: "v1" });
      reg.transitionManifest("order-service", "v1", "published");
      reg.transitionManifest("order-service", "v1", "active");

      // v2 매니페스트
      reg.registerPrefix("cart_event", "v2");
      reg.transitionPrefix("cart_event", "v2", "released");
      reg.createManifest("order-service", "v2", { order_event: "v1", cart_event: "v2" });
      reg.transitionManifest("order-service", "v2", "published");
      reg.transitionManifest("order-service", "v2", "active");

      // v1 매니페스트는 superseded
      expect(reg.getManifest("order-service", "v1").state).toBe("superseded");
      // v2 매니페스트는 active
      expect(reg.getManifest("order-service", "v2").state).toBe("active");
    });
  });

  describe("조회 API", () => {
    it("getActiveManifest로 현재 active 매니페스트 조회", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.createManifest("order-service", "v1", { order_event: "v1" });
      reg.transitionManifest("order-service", "v1", "published");
      reg.transitionManifest("order-service", "v1", "active");

      const m = reg.getActiveManifest("order-service");
      expect(m).not.toBeNull();
      expect(m!.manifestVersion).toBe("v1");
    });

    it("getPrefixVersionFromManifest로 매니페스트 내 prefix 버전 조회", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.createManifest("order-service", "v1", { order_event: "v1" });

      const v = reg.getPrefixVersionFromManifest("order-service", "v1", "order_event");
      expect(v).toBe("v1");
    });

    it("listManifests로 전체 이력 조회", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.createManifest("order-service", "v1", { order_event: "v1" });
      reg.createManifest("order-service", "v2", { order_event: "v1" });

      expect(reg.listManifests("order-service")).toHaveLength(2);
    });

    it("getActivePrefixVersion으로 현재 active prefix 조회", () => {
      const reg = new ManifestRegistry();
      reg.registerPrefix("order_event", "v1");
      reg.transitionPrefix("order_event", "v1", "released");
      reg.transitionPrefix("order_event", "v1", "active");

      const p = reg.getActivePrefixVersion("order_event");
      expect(p).not.toBeNull();
      expect(p!.version).toBe("v1");
    });
  });

  describe("공급 체인 전체 시나리오", () => {
    it("prefix 정의 → 릴리스 → 매니페스트 구성 → 발행 → 활성화 → 버전 전환", () => {
      const reg = new ManifestRegistry();

      // ① prefix 정의
      reg.registerPrefix("order_event", "v1");
      reg.registerPrefix("cart_event", "v1");

      // ② 릴리스
      reg.transitionPrefix("order_event", "v1", "released");
      reg.transitionPrefix("cart_event", "v1", "released");

      // ③ 매니페스트 구성
      reg.createManifest("order-service", "v1", {
        order_event: "v1",
        cart_event: "v1",
      });

      // ④ 발행
      reg.transitionManifest("order-service", "v1", "published");

      // ⑤ 활성화
      reg.transitionManifest("order-service", "v1", "active");

      // 상태 확인
      expect(reg.getActiveManifest("order-service")!.manifestVersion).toBe("v1");
      expect(reg.getPrefixRecord("order_event", "v1").state).toBe("active");
      expect(reg.getPrefixRecord("cart_event", "v1").state).toBe("active");

      // ⑥ 버전 전환: cart_event v2 추가
      reg.registerPrefix("cart_event", "v2");
      reg.transitionPrefix("cart_event", "v2", "released");

      reg.createManifest("order-service", "v2", {
        order_event: "v1",
        cart_event: "v2",
      }, "cart_event v1→v2");
      reg.transitionManifest("order-service", "v2", "published");
      reg.transitionManifest("order-service", "v2", "active");

      // v1 매니페스트 superseded, v2 active
      expect(reg.getManifest("order-service", "v1").state).toBe("superseded");
      expect(reg.getActiveManifest("order-service")!.manifestVersion).toBe("v2");

      // cart_event v1 deprecated 가능 (v2가 active)
      reg.transitionPrefix("cart_event", "v1", "deprecated");
      expect(reg.getPrefixRecord("cart_event", "v1").state).toBe("deprecated");

      // 과거 이벤트 디코딩: superseded 매니페스트 조회 가능
      const oldManifest = reg.getManifest("order-service", "v1");
      expect(oldManifest.prefixes["cart_event"]).toBe("v1");
    });
  });
});
