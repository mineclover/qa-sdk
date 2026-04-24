import { describe, expect, it } from "vitest";
import { resolveLocalPort } from "../../src/providers/pulumi-deploy.js";

describe("resolveLocalPort", () => {
  it("test env는 dev와 다른 오프셋을 사용한다", () => {
    expect(resolveLocalPort("dev", 3200)).toBe(23200);
    expect(resolveLocalPort("test", 3200)).toBe(26200);
  });

  it("알 수 없는 env는 fallback 오프셋을 사용한다", () => {
    expect(resolveLocalPort("preview", 3200)).toBe(27200);
  });
});
