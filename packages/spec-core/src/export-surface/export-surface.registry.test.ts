import { describe, it, expect, beforeEach } from "vitest";
import { ExportSurfaceRegistry } from "./export-surface.registry.js";
import { DuplicateRegistrationError, NotFoundError } from "spec-schema";

describe("ExportSurfaceRegistry", () => {
  let registry: ExportSurfaceRegistry;

  beforeEach(() => {
    registry = new ExportSurfaceRegistry();
  });

  describe("register + get", () => {
    it("registers and retrieves an export surface", () => {
      registry.register("permission", {
        dims: ["action", "role"],
        pattern: "{action}.{role}",
      });

      const surface = registry.get("permission");
      expect(surface.dims).toEqual(["action", "role"]);
      expect(surface.pattern).toBe("{action}.{role}");
    });

    it("throws on duplicate registration", () => {
      registry.register("permission", { dims: ["action"], pattern: "{action}" });
      expect(() =>
        registry.register("permission", { dims: ["role"], pattern: "{role}" }),
      ).toThrow(DuplicateRegistrationError);
    });

    it("throws on get for unregistered prefix", () => {
      expect(() => registry.get("unknown")).toThrow(NotFoundError);
    });
  });

  describe("resolve", () => {
    it("resolves permission export title", () => {
      registry.register("permission", {
        dims: ["action", "role"],
        pattern: "{action}.{role}",
      });

      const title = registry.resolve("permission", { action: "add", role: "admin" });
      expect(title).toBe("add.admin");
    });

    it("resolves service export title with slash separator", () => {
      registry.register("service", {
        dims: ["env", "svc_name"],
        pattern: "{env}/{svc_name}",
      });

      const title = registry.resolve("service", { env: "prod", svc_name: "shopping-web" });
      expect(title).toBe("prod/shopping-web");
    });

    it("resolves single-dim export title", () => {
      registry.register("cart_event", {
        dims: ["action"],
        pattern: "{action}",
      });

      const title = registry.resolve("cart_event", { action: "add" });
      expect(title).toBe("add");
    });

    it("throws on missing dimension value", () => {
      registry.register("permission", {
        dims: ["action", "role"],
        pattern: "{action}.{role}",
      });

      expect(() =>
        registry.resolve("permission", { action: "add" }),
      ).toThrow('Missing value for dimension "role"');
    });

    it("ignores extra values not in pattern", () => {
      registry.register("permission", {
        dims: ["action", "role"],
        pattern: "{action}.{role}",
      });

      const title = registry.resolve("permission", {
        action: "add",
        role: "admin",
        env: "prod",       // 내부 차원, 패턴에 없음
        svc: "shopping",   // 내부 차원, 패턴에 없음
      });
      expect(title).toBe("add.admin");
    });
  });

  describe("has + keys + size", () => {
    it("reports correct state", () => {
      expect(registry.has("permission")).toBe(false);
      expect(registry.size).toBe(0);

      registry.register("permission", { dims: ["action"], pattern: "{action}" });
      registry.register("service", { dims: ["env"], pattern: "{env}" });

      expect(registry.has("permission")).toBe(true);
      expect(registry.has("unknown")).toBe(false);
      expect(registry.size).toBe(2);
      expect([...registry.keys()]).toEqual(["permission", "service"]);
    });
  });
});
