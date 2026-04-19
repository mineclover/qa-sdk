// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { describe, it, expect } from "vitest";

describe("facet-tests 패키지 구조 검증", () => {
  it("패키지가 vitest로 동작한다", () => {
    expect(true).toBe(true);
  });

  it("__mocks__ stub이 import 가능하다", async () => {
    const { env } = await import("../../__mocks__/gate-service/src/config/env.js");
    expect(env.PORT).toBe(3400);
    expect(env.SQLITE_PATH).toBe(":memory:");
  });
});
