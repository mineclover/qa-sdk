/**
 * 생성된 타입의 smoke 테스트.
 * - PrefixId union이 실제 prefix 이름을 포함하는지
 * - sdk.encode/decode가 타입 안전한지
 * - DSL bundle const가 올바른지
 */
import { describe, it, expect } from "vitest";
import {
  PREFIX_IDS, AXIS_IDS,
  type PrefixId, type AxisId,
  sdk,
  DSL_OBSERVATION, DSL_IDS,
  type DslId,
} from "./index.js";

describe("generated prefix-ids", () => {
  it("PrefixId에 permission이 포함된다", () => {
    const id: PrefixId = "permission";
    expect(PREFIX_IDS).toContain(id);
  });

  it("AxisId에 env가 포함된다", () => {
    const id: AxisId = "env";
    expect(AXIS_IDS).toContain(id);
  });

  it("PREFIX_IDS 배열이 비어있지 않다", () => {
    expect(PREFIX_IDS.length).toBeGreaterThan(0);
  });
});

describe("generated sdk-factory", () => {
  it("sdk.encode가 정수를 반환한다", () => {
    // permission prefix의 axis dims만 사용 (prefix_ref는 제외)
    const addr = sdk.encode("permission", { role: "admin" });
    expect(typeof addr).toBe("number");
  });

  it("sdk.decode가 객체를 반환한다", () => {
    const addr = sdk.encode("permission", { role: "admin" });
    const decoded = sdk.decode("permission", addr);
    expect(decoded.role).toBe("admin");
  });
});

describe("generated dsl", () => {
  it("DSL_OBSERVATION에 page_view가 포함된다", () => {
    expect(DSL_OBSERVATION.members).toContain("page_view");
  });

  it("DslId에 dsl-observation이 포함된다", () => {
    const id: DslId = "dsl-observation";
    expect(DSL_IDS).toContain(id);
  });
});
