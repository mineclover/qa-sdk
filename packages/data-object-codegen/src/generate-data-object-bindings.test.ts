import { describe, expect, it } from "vitest";
import type { Catalog, DataObjectBinding, DataSchema } from "@qa-sdk/core";
import { generateDataObjectBindings } from "./generate-data-object-bindings.js";

const TEST_CATALOG: Catalog = {
  id: "data-object-demo",
  name: "Data Object Demo",
  axes: {
    region: {
      id: "region",
      name: "Region",
      versions: {
        v1: {
          entries: ["kr", "us"],
          capacity: 4,
        },
      },
    },
    tier: {
      id: "tier",
      name: "Tier",
      versions: {
        v1: {
          entries: ["free", "pro"],
          capacity: 4,
        },
      },
    },
  },
  prefixes: {
    member_profile: {
      id: "member_profile",
      name: "Member Profile",
      labels: ["memberId", "region", "tier"],
      dims: {
        memberId: { kind: "table_ref", table: "members" },
        region: { kind: "axis", axisId: "region" },
        tier: { kind: "axis", axisId: "tier" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: {
            region: "v1",
            tier: "v1",
          },
        },
      ],
    },
    member_snapshot: {
      id: "member_snapshot",
      name: "Member Snapshot",
      labels: ["memberId", "region", "tier"],
      dims: {
        memberId: { kind: "table_ref", table: "members" },
        region: { kind: "axis", axisId: "region" },
        tier: { kind: "axis", axisId: "tier" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: {
            region: "v1",
            tier: "v1",
          },
        },
      ],
    },
  },
};

const TEST_SCHEMAS: DataSchema[] = [
  {
    schemaId: "members",
    version: "v1",
    primaryKey: ["id"],
    schemaHash: "schema-members-v1",
    columns: {
      id: { ref: { kind: "scalar", type: "string" }, required: true, facetRole: "identity" },
      region: { ref: { kind: "scalar", type: "string" }, required: true },
      tier: { ref: { kind: "scalar", type: "string" }, required: false },
      email: { ref: { kind: "scalar", type: "string" }, required: false },
    },
  },
  {
    schemaId: "member_projection",
    version: "v1",
    primaryKey: ["id"],
    schemaHash: "schema-member-projection-v1",
    columns: {
      id: { ref: { kind: "scalar", type: "string" }, required: true, facetRole: "identity" },
      region: { ref: { kind: "scalar", type: "string" }, required: true },
      tier: { ref: { kind: "scalar", type: "string" }, required: false },
      email: { ref: { kind: "scalar", type: "string" }, required: false },
    },
  },
];

const TEST_BINDINGS: DataObjectBinding[] = [
  {
    schemaId: "members",
    schemaVersion: "v1",
    prefixId: "member_profile",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
      region: { dimLabel: "region" },
      tier: { dimLabel: "tier" },
    },
  },
  {
    schemaId: "member_projection",
    schemaVersion: "v1",
    prefixId: "member_snapshot",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
      region: { dimLabel: "region" },
      tier: { dimLabel: "tier" },
    },
  },
];

describe("generateDataObjectBindings", () => {
  it("4개 생성 파일을 반환한다", () => {
    const result = generateDataObjectBindings(TEST_CATALOG, TEST_SCHEMAS, TEST_BINDINGS);

    expect(result.files).toHaveLength(4);
    expect(result.files.map((file) => file.path)).toEqual([
      "data-objects.ts",
      "binding-registry.ts",
      "lineage-types.ts",
      "index.ts",
    ]);
  });

  it("data-objects.ts에 prefix 기반 타입명을 생성한다", () => {
    const result = generateDataObjectBindings(TEST_CATALOG, TEST_SCHEMAS, TEST_BINDINGS);
    const content = result.files.find((file) => file.path === "data-objects.ts")?.content ?? "";

    expect(content).toContain("export interface MemberProfileData");
    expect(content).toContain('region: "kr" | "us";');
    expect(content).toContain('tier?: "free" | "pro";');
    expect(content).toContain("export type MembersMemberProfileBoundDataObject");
  });

  it("binding-registry.ts에 레지스트리 초기화 코드를 생성한다", () => {
    const result = generateDataObjectBindings(TEST_CATALOG, TEST_SCHEMAS, TEST_BINDINGS);
    const content = result.files.find((file) => file.path === "binding-registry.ts")?.content ?? "";

    expect(content).toContain("export const DATA_OBJECT_BINDINGS");
    expect(content).toContain("export function createBindingRegistry()");
    expect(content).toContain("export const BINDING_REGISTRY = createBindingRegistry()");
  });

  it("lineage-types.ts에 유효 계보 타입을 생성한다", () => {
    const result = generateDataObjectBindings(TEST_CATALOG, TEST_SCHEMAS, TEST_BINDINGS);
    const content = result.files.find((file) => file.path === "lineage-types.ts")?.content ?? "";

    expect(content).toContain("export type MembersV1ToMemberProjectionV1LineageField");
    expect(content).toContain('source: "members";');
    expect(content).toContain('target: "member_projection";');
    expect(content).toContain('field: MembersV1ToMemberProjectionV1LineageField;');
  });

  it("같은 입력이면 contentHash가 결정론적이다", () => {
    const left = generateDataObjectBindings(TEST_CATALOG, TEST_SCHEMAS, TEST_BINDINGS);
    const right = generateDataObjectBindings(
      TEST_CATALOG,
      TEST_SCHEMAS.toReversed(),
      TEST_BINDINGS.toReversed(),
    );

    expect(left.contentHash).toBe(right.contentHash);
    expect(left.contentHash).toHaveLength(12);
  });
});
