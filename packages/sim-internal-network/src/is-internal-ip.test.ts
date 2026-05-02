import { describe, it, expect } from "vitest";
import { isInternalIp } from "./is-internal-ip.js";

describe("isInternalIp (sim-internal-network §3)", () => {
  it("internal 범주 5종 모두 true", () => {
    for (const ip of ["172.17.0.5", "172.16.0.0", "172.31.255.255", "10.5.5.5",
                      "192.168.0.1", "127.0.0.1", "::1",
                      "::ffff:172.17.0.5", "::ffff:127.0.0.1"]) expect(isInternalIp(ip)).toBe(true);
  });
  it("외부/경계 외 → false", () => {
    for (const ip of ["8.8.8.8", "203.0.113.42", "172.32.0.1", "172.15.255.255",
                      "11.0.0.0", "192.169.0.1", "128.0.0.1", "::ffff:8.8.8.8"]) expect(isInternalIp(ip)).toBe(false);
  });
  it("malformed → false (throw 금지)", () => {
    for (const bad of ["", "not-an-ip", "999.999.999.999", "192.168.1", "192.168.1.256"]) expect(isInternalIp(bad)).toBe(false);
  });
});
