import { beforeEach, describe, expect, it } from "vitest";
import { BindingRegistry } from "./registry.js";
import type { DataObjectBinding } from "./types.js";

function makeBinding(schemaId: string, prefixId = "user_event"): DataObjectBinding {
  return {
    schemaId,
    schemaVersion: "v1",
    prefixId,
    prefixVersion: "v2",
    columnToAxis: {
      service: { dimLabel: "service" },
      region: { dimLabel: "region", segmentId: "apac" },
    },
  };
}

describe("BindingRegistry", () => {
  let registry: BindingRegistry;

  beforeEach(() => {
    registry = new BindingRegistry();
  });

  it("register 후 schemaId로 바인딩을 조회한다", () => {
    const binding = makeBinding("order-summary");
    registry.register(binding);

    expect(registry.getBySchema("order-summary")).toEqual(binding);
  });

  it("중복 schemaId 등록 시 에러", () => {
    registry.register(makeBinding("dup-schema"));

    expect(() => registry.register(makeBinding("dup-schema", "another_prefix"))).toThrow(
      'Binding already registered for schemaId: "dup-schema"',
    );
  });

  it("prefixId로 연결된 모든 바인딩을 반환한다", () => {
    const first = makeBinding("user-profile", "user_prefix");
    const second = makeBinding("user-session", "user_prefix");
    const third = makeBinding("payment-summary", "payment_prefix");

    registry.register(first);
    registry.register(second);
    registry.register(third);

    expect(registry.getByPrefix("user_prefix")).toEqual([first, second]);
  });

  it("listAll은 전체 바인딩을 등록 순서대로 반환한다", () => {
    const first = makeBinding("schema-a", "prefix-a");
    const second = makeBinding("schema-b", "prefix-b");

    registry.register(first);
    registry.register(second);

    expect(registry.listAll()).toEqual([first, second]);
  });

  it("remove는 등록된 바인딩을 삭제하고 prefix 인덱스도 정리한다", () => {
    registry.register(makeBinding("schema-a", "shared-prefix"));
    registry.register(makeBinding("schema-b", "shared-prefix"));

    expect(registry.remove("schema-a")).toBe(true);
    expect(registry.getBySchema("schema-a")).toBeNull();
    expect(registry.getByPrefix("shared-prefix")).toEqual([makeBinding("schema-b", "shared-prefix")]);
  });

  it("없는 schemaId 삭제는 false를 반환한다", () => {
    expect(registry.remove("missing-schema")).toBe(false);
  });

  it("조회 결과를 수정해도 내부 저장소는 변하지 않는다", () => {
    registry.register(makeBinding("schema-a", "prefix-a"));

    const binding = registry.getBySchema("schema-a");
    expect(binding).not.toBeNull();

    binding!.columnToAxis.service.dimLabel = "mutated";
    expect(registry.getBySchema("schema-a")!.columnToAxis.service.dimLabel).toBe("service");
  });
});
