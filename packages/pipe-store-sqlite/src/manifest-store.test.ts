// @def.doc pipe-store-sqlite
import { describe, it, expect, beforeEach } from "vitest";
import { SqliteManifestRegistry } from "./manifest-store.js";

describe("SqliteManifestRegistry", () => {
  let reg: SqliteManifestRegistry;

  beforeEach(() => {
    reg = new SqliteManifestRegistry(":memory:");
  });

  // ── Prefix 라이프사이클 ────────────────────────────

  describe("Prefix 라이프사이클", () => {
    it("prefix를 draft로 등록", () => {
      const record = reg.registerPrefix("tracking", "v1");
      expect(record.state).toBe("draft");
      expect(record.prefixId).toBe("tracking");
    });

    it("draft → released 전이", () => {
      reg.registerPrefix("tracking", "v1");
      const released = reg.transitionPrefix("tracking", "v1", "released");
      expect(released.state).toBe("released");
      expect(released.releasedAt).toBeDefined();
    });

    it("released → active 전이", () => {
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      const active = reg.transitionPrefix("tracking", "v1", "active");
      expect(active.state).toBe("active");
    });

    it("무효 전이는 에러", () => {
      reg.registerPrefix("tracking", "v1");
      expect(() => reg.transitionPrefix("tracking", "v1", "active")).toThrow("전이 불가");
    });

    it("중복 prefix 등록 에러", () => {
      reg.registerPrefix("tracking", "v1");
      expect(() => reg.registerPrefix("tracking", "v1")).toThrow("이미 존재");
    });

    it("getActivePrefixVersion", () => {
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      reg.transitionPrefix("tracking", "v1", "active");

      const active = reg.getActivePrefixVersion("tracking");
      expect(active!.version).toBe("v1");
      expect(active!.state).toBe("active");
    });
  });

  // ── Manifest 라이프사이클 ──────────────────────────

  describe("Manifest 라이프사이클", () => {
    it("매니페스트를 draft로 생성", () => {
      const m = reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });
      expect(m.state).toBe("draft");
      expect(m.prefixes.tracking).toBe("v1");
    });

    it("draft → published (모든 prefix released 이상)", () => {
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });

      const published = reg.transitionManifest("order-svc", "1.0.0", "published");
      expect(published.state).toBe("published");
    });

    it("draft → published 실패 (draft prefix 포함)", () => {
      reg.registerPrefix("tracking", "v1");
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });

      expect(() => reg.transitionManifest("order-svc", "1.0.0", "published")).toThrow("draft");
    });

    it("published → active (prefix 자동 active 전이)", () => {
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });
      reg.transitionManifest("order-svc", "1.0.0", "published");

      const active = reg.transitionManifest("order-svc", "1.0.0", "active");
      expect(active.state).toBe("active");

      // prefix도 자동 active
      const prefix = reg.getPrefixRecord("tracking", "v1");
      expect(prefix.state).toBe("active");
    });

    it("새 매니페스트 active 시 이전 superseded", () => {
      // v1 활성화
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });
      reg.transitionManifest("order-svc", "1.0.0", "published");
      reg.transitionManifest("order-svc", "1.0.0", "active");

      // v2 활성화
      reg.registerPrefix("tracking", "v2");
      reg.transitionPrefix("tracking", "v2", "released");
      reg.createManifest("order-svc", "2.0.0", { tracking: "v2" });
      reg.transitionManifest("order-svc", "2.0.0", "published");
      reg.transitionManifest("order-svc", "2.0.0", "active");

      // v1은 superseded
      const v1 = reg.getManifest("order-svc", "1.0.0");
      expect(v1.state).toBe("superseded");
    });
  });

  // ── 조회 API ───────────────────────────────────────

  describe("조회 API", () => {
    it("getActiveManifest", () => {
      reg.registerPrefix("tracking", "v1");
      reg.transitionPrefix("tracking", "v1", "released");
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1" });
      reg.transitionManifest("order-svc", "1.0.0", "published");
      reg.transitionManifest("order-svc", "1.0.0", "active");

      const active = reg.getActiveManifest("order-svc");
      expect(active!.manifestVersion).toBe("1.0.0");
    });

    it("listManifests", () => {
      reg.createManifest("order-svc", "1.0.0", {});
      reg.createManifest("order-svc", "2.0.0", {});
      reg.createManifest("other-svc", "1.0.0", {});

      const list = reg.listManifests("order-svc");
      expect(list).toHaveLength(2);
    });

    it("getPrefixVersionFromManifest", () => {
      reg.createManifest("order-svc", "1.0.0", { tracking: "v1", page_view: "v2" });

      expect(reg.getPrefixVersionFromManifest("order-svc", "1.0.0", "tracking")).toBe("v1");
      expect(reg.getPrefixVersionFromManifest("order-svc", "1.0.0", "page_view")).toBe("v2");
    });
  });

  // ── 데이터 영속성 ─────────────────────────────────

  describe("SQLite 영속성", () => {
    it("save → 재조회 — 타임스탬프 보존", () => {
      const record = reg.registerPrefix("tracking", "v1");
      const loaded = reg.getPrefixRecord("tracking", "v1");
      expect(loaded.createdAt).toBe(record.createdAt);
    });

    it("매니페스트 changelog 보존", () => {
      reg.createManifest("svc", "1.0.0", {}, "초기 릴리스");
      const loaded = reg.getManifest("svc", "1.0.0");
      expect(loaded.changelog).toBe("초기 릴리스");
    });
  });
});
