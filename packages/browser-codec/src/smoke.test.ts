import { describe, it, expect } from "vitest";
import { encode, decode, track, BROWSER_CATALOG } from "./index.js";

describe("@qa-sdk/browser-codec smoke test", () => {
  it("BROWSER_CATALOG has prefixes", () => {
    expect(Object.keys(BROWSER_CATALOG).length).toBeGreaterThan(10);
    expect(BROWSER_CATALOG["service"]).toBeDefined();
    expect(BROWSER_CATALOG["tracking"]).toBeDefined();
  });

  it("encode/decode roundtrip — tracking", () => {
    const result = encode(BROWSER_CATALOG, "tracking", {
      trackAction: "click",
      page: "home",
      userType: "guest",
    });
    expect(result).not.toBeNull();
    expect(result!.address).toBeGreaterThanOrEqual(0);
    expect(result!.serialized).toMatch(/^tracking:v\d+:\d+$/);

    const decoded = decode(BROWSER_CATALOG, result!.serialized);
    expect(decoded).not.toBeNull();
    expect(decoded!.values.trackAction).toBe("click");
    expect(decoded!.values.page).toBe("home");
    expect(decoded!.values.userType).toBe("guest");
  });

  it("encode/decode roundtrip — rbac", () => {
    const result = encode(BROWSER_CATALOG, "rbac", {
      role: "admin",
      action: "read",
      resource: "dashboard",
    });
    expect(result).not.toBeNull();

    const decoded = decode(BROWSER_CATALOG, result!.serialized);
    expect(decoded).not.toBeNull();
    expect(decoded!.values.role).toBe("admin");
    expect(decoded!.values.action).toBe("read");
    expect(decoded!.values.resource).toBe("dashboard");
  });

  it("track returns address_context", () => {
    const ctx = track(BROWSER_CATALOG, {
      tracking: { trackAction: "click", page: "home", userType: "guest" },
    });
    expect(ctx).toBeDefined();
    expect(ctx["tracking"]).toMatch(/^tracking:v/);
  });

  it("encode with invalid prefix returns null", () => {
    const result = encode(BROWSER_CATALOG, "nonexistent_prefix", {
      foo: "bar",
    });
    expect(result).toBeNull();
  });

  it("decode with wrong prefix returns null", () => {
    const result = decode(BROWSER_CATALOG, "nonexistent_prefix:v1:0");
    expect(result).toBeNull();
  });
});
