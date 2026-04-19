// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from "vitest";
import type { Catalog } from "../catalog/catalog.types.js";
import { chainSegments } from "../catalog/path-summation.js";
import type { FieldLineage } from "../types/data-schema.js";
import { BindingRegistry } from "./registry.js";
import { validateLineageChainDetailed } from "./validate.js";
import { validateBindings, validateLineageChain } from "./validate.js";
import type { DataObjectBinding } from "./types.js";

const TEST_CATALOG: Catalog = {
  id: "binding-test",
  name: "Binding Test Catalog",
  axes: {
    member_id: {
      id: "member_id",
      name: "Member ID",
      versions: {
        v1: { entries: ["m1", "m2"], capacity: 4 },
      },
    },
    order_id: {
      id: "order_id",
      name: "Order ID",
      versions: {
        v1: { entries: ["o1", "o2"], capacity: 4 },
      },
    },
    payment_method: {
      id: "payment_method",
      name: "Payment Method",
      versions: {
        v1: { entries: ["card", "bank"], capacity: 4 },
      },
    },
    shipping_option: {
      id: "shipping_option",
      name: "Shipping Option",
      versions: {
        v1: { entries: ["standard", "same_day"], capacity: 4 },
      },
    },
    region_id: {
      id: "region_id",
      name: "Region ID",
      versions: {
        v1: { entries: ["kr", "us"], capacity: 4 },
      },
    },
  },
  prefixes: {
    member_identity: {
      id: "member_identity",
      name: "Member Identity",
      labels: ["memberId"],
      dims: {
        memberId: { kind: "axis", axisId: "member_id" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: { memberId: "v1" },
        },
      ],
    },
    order_route: {
      id: "order_route",
      name: "Order Route",
      labels: ["orderId", "paymentMethod", "shippingOption"],
      dims: {
        orderId: { kind: "axis", axisId: "order_id" },
        paymentMethod: { kind: "axis", axisId: "payment_method" },
        shippingOption: { kind: "axis", axisId: "shipping_option" },
      },
      addressModel: "sum",
      versions: [
        {
          version: "v1",
          axisVersions: {
            orderId: "v1",
            paymentMethod: "v1",
            shippingOption: "v1",
          },
          segments: chainSegments([
            { segmentId: "order_payment", consumes: ["orderId", "paymentMethod"], shape: [4, 4] },
            { segmentId: "order_shipping", consumes: ["orderId", "shippingOption"], shape: [4, 4] },
          ]),
        },
      ],
    },
    region_identity: {
      id: "region_identity",
      name: "Region Identity",
      labels: ["regionId"],
      dims: {
        regionId: { kind: "axis", axisId: "region_id" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: { regionId: "v1" },
        },
      ],
    },
  },
  tables: {
    members: {
      table: "members",
      columns: {
        id: { kind: "scalar", type: "string" },
      },
    },
    members_backup: {
      table: "members_backup",
      columns: {
        id: { kind: "scalar", type: "string" },
      },
    },
    orders: {
      table: "orders",
      columns: {
        id: { kind: "scalar", type: "string" },
        payment_method: { kind: "axis_ref", axisId: "payment_method" },
        shipping_option: { kind: "axis_ref", axisId: "shipping_option" },
      },
    },
  },
};

function makeBinding(overrides: Partial<DataObjectBinding> = {}): DataObjectBinding {
  return {
    schemaId: "members",
    schemaVersion: "v1",
    prefixId: "member_identity",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
    },
    ...overrides,
  };
}

describe("validateBindings", () => {
  it("product prefix 바인딩이 카탈로그와 정합하면 에러가 없다", () => {
    const [result] = validateBindings([makeBinding()], TEST_CATALOG);

    expect(result).toEqual({
      schemaId: "members",
      prefixId: "member_identity",
      errors: [],
      warnings: [],
    });
  });

  it("sum prefix의 유효한 segmentId를 허용한다", () => {
    const [result] = validateBindings([
      makeBinding({
        schemaId: "orders",
        prefixId: "order_route",
        columnToAxis: {
          id: { dimLabel: "orderId" },
          payment_method: { dimLabel: "paymentMethod", segmentId: "order_payment" },
          shipping_option: { dimLabel: "shippingOption", segmentId: "order_shipping" },
        },
      }),
    ], TEST_CATALOG);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("카탈로그에 schema table이 없으면 warning으로 남기고 다른 검증은 계속한다", () => {
    const [result] = validateBindings([
      makeBinding({
        schemaId: "external_schema",
        prefixId: "region_identity",
        columnToAxis: {
          external_id: { dimLabel: "regionId" },
        },
      }),
    ], TEST_CATALOG);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'schema "external_schema" table not found in catalog; identity 검증 생략',
    ]);
  });

  it("identity 컬럼 id가 매핑되지 않으면 에러", () => {
    const [result] = validateBindings([
      makeBinding({
        columnToAxis: {},
      }),
    ], TEST_CATALOG);

    expect(result.errors).toContain(
      'schema "members" identity 컬럼 "id"가 columnToAxis에 매핑되지 않음',
    );
  });

  it("존재하지 않는 dimLabel을 매핑하면 에러", () => {
    const [result] = validateBindings([
      makeBinding({
        columnToAxis: {
          id: { dimLabel: "missingDim" },
        },
      }),
    ], TEST_CATALOG);

    expect(result.errors).toContain(
      'column "id" → dim "missingDim"이 prefix "member_identity"에 없음',
    );
  });

  it("sum prefix에 없는 segmentId를 지정하면 에러", () => {
    const [result] = validateBindings([
      makeBinding({
        schemaId: "orders",
        prefixId: "order_route",
        columnToAxis: {
          id: { dimLabel: "orderId" },
          payment_method: { dimLabel: "paymentMethod", segmentId: "missing_segment" },
        },
      }),
    ], TEST_CATALOG);

    expect(result.errors).toContain(
      'column "payment_method"의 segmentId "missing_segment"가 prefix "order_route:v1" segments에 없음',
    );
  });

  it("같은 prefix:version에 중복 바인딩이 있으면 모두 에러", () => {
    const results = validateBindings([
      makeBinding(),
      makeBinding({
        schemaId: "members_backup",
      }),
    ], TEST_CATALOG);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.errors).toContain(
        'prefix "member_identity:v1"에 중복 바인딩 존재: members, members_backup',
      );
    }
  });
});

describe("validateLineageChain", () => {
  it("source와 target schema가 모두 바인딩되고 target dim이 이어지면 bound로 집계한다", () => {
    const registry = makeRegistry([
      makeBinding({
        schemaId: "members",
        prefixId: "member_identity",
        columnToAxis: {
          id: { dimLabel: "memberId" },
        },
      }),
      makeBinding({
        schemaId: "member_projection",
        prefixId: "member_identity",
        columnToAxis: {
          member_id: { dimLabel: "memberId" },
        },
      }),
    ]);

    const result = validateLineageChain([
      makeLineage(["members", "id"], ["member_projection", "member_id"]),
    ], registry);

    expect(result).toEqual({
      bound: 1,
      unbound: 0,
      mismatched: 0,
    });
  });

  it("source 또는 target 바인딩이 없으면 unbound로 집계한다", () => {
    const registry = makeRegistry([
      makeBinding({
        schemaId: "members",
        prefixId: "member_identity",
        columnToAxis: {
          id: { dimLabel: "memberId" },
        },
      }),
    ]);

    const result = validateLineageChain([
      makeLineage(["members", "id"], ["member_projection", "member_id"]),
    ], registry);

    expect(result).toEqual({
      bound: 0,
      unbound: 1,
      mismatched: 0,
    });
  });

  it("양쪽 바인딩은 있지만 target dim mapping과 이어지지 않으면 mismatched로 집계한다", () => {
    const registry = makeRegistry([
      makeBinding({
        schemaId: "members",
        prefixId: "member_identity",
        columnToAxis: {
          id: { dimLabel: "memberId" },
        },
      }),
      makeBinding({
        schemaId: "member_region_projection",
        prefixId: "region_identity",
        columnToAxis: {
          member_region: { dimLabel: "regionId" },
        },
      }),
    ]);

    const result = validateLineageChain([
      makeLineage(["members", "id"], ["member_region_projection", "member_region"]),
    ], registry);

    expect(result).toEqual({
      bound: 0,
      unbound: 0,
      mismatched: 1,
    });
  });
});

describe("validateLineageChainDetailed", () => {
  it("unbound → issue에 사유 포함", () => {
    const registry = makeRegistry([]);
    const result = validateLineageChainDetailed([
      makeLineage(["src", "col"], ["target", "col"]),
    ], registry);
    expect(result.unbound).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kind).toBe("unbound");
    expect(result.issues[0].reason).toContain("target");
  });

  it("mismatched → issue에 target 식별 정보 포함", () => {
    const registry = makeRegistry([
      makeBinding({ schemaId: "members", prefixId: "p1", columnToAxis: { id: { dimLabel: "memberId" } } }),
      makeBinding({ schemaId: "other", prefixId: "p2", columnToAxis: { col: { dimLabel: "otherId" } } }),
    ]);
    const result = validateLineageChainDetailed([
      makeLineage(["members", "id"], ["other", "col"]),
    ], registry);
    expect(result.mismatched).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kind).toBe("mismatched");
    expect(result.issues[0].target.schemaId).toBe("other");
  });

  it("bound → issues 비어있음", () => {
    const registry = makeRegistry([
      makeBinding({ schemaId: "members", prefixId: "p1", columnToAxis: { id: { dimLabel: "memberId" } } }),
      makeBinding({ schemaId: "proj", prefixId: "p1", columnToAxis: { member_id: { dimLabel: "memberId" } } }),
    ]);
    const result = validateLineageChainDetailed([
      makeLineage(["members", "id"], ["proj", "member_id"]),
    ], registry);
    expect(result.bound).toBe(1);
    expect(result.issues).toEqual([]);
  });
});

function makeLineage(
  source: [schemaId: string, column: string],
  target: [schemaId: string, column: string],
): FieldLineage {
  return {
    target: { schemaId: target[0], column: target[1] },
    sources: [{ schemaId: source[0], column: source[1] }],
    transform: "direct",
    pipeId: "pipe.member-sync",
    stepPath: "sync.member-id",
  };
}

function makeRegistry(bindings: readonly DataObjectBinding[]): BindingRegistry {
  const registry = new BindingRegistry();

  for (const binding of bindings) {
    registry.register(binding);
  }

  return registry;
}
