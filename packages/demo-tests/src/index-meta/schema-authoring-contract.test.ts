import { describe, expect, it } from "vitest";
import {
  MetaRegistry,
  InMemoryPrefixRegistry,
  compileSchema,
  defineTable,
  syncSchemaToRegistry,
  type MetaRegistryInput,
} from "index-meta";

const roleTable = defineTable("role", {
  source: { kind: { type: "string_enum" as const } },
  versions: { v1: { capacity: 3 } },
});

const actionTable = defineTable("action", {
  source: { kind: { type: "string_enum" as const } },
  versions: { v1: { capacity: 2 } },
});

const resourceTable = defineTable("resource", {
  source: { kind: { type: "string_enum" as const } },
  versions: { v1: { capacity: 3 } },
});

const permTable = defineTable("perm", {
  dims: [roleTable, actionTable, resourceTable],
  versions: {
    v1: {
      refs: {
        role: { prefix: "role", version: "v1" },
        action: { prefix: "action", version: "v1" },
        resource: { prefix: "resource", version: "v1" },
      },
    },
  },
});

const REGISTRY_INPUT: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["GET", "POST"] },
      },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin/teams", "billing/invoices", "dashboard"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: {
          snapshots: {
            role: "v1",
            action: "v1",
            resource: "v1",
          },
        },
      },
    },
  },
};

describe("index-meta schema authoring contract", () => {
  it("TableDef/CompiledSchema and MetaRegistryInput describe the same shape", async () => {
    const compiled = compileSchema([permTable]);
    const prefixRegistry = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(compiled, prefixRegistry);

    const metaRegistry = new MetaRegistry(REGISTRY_INPUT);
    const weightedIndex = metaRegistry.getWeightedIndex("perm", "v1");

    expect(await prefixRegistry.getShape("role", "v1")).toEqual([3]);
    expect(await prefixRegistry.getShape("action", "v1")).toEqual([2]);
    expect(await prefixRegistry.getShape("resource", "v1")).toEqual([3]);
    expect(await prefixRegistry.getShape("perm", "v1")).toEqual([
      ...weightedIndex.shape,
    ]);

    const record = await prefixRegistry.getRecord("perm", "v1");
    expect(record).toEqual({
      prefix: "perm",
      versionId: "v1",
      capacity: weightedIndex.size,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 3 },
        { prefix: "action", versionId: "v1", capacity: 2 },
        { prefix: "resource", versionId: "v1", capacity: 3 },
      ],
    });
  });

  it("encoded addresses from MetaRegistry remain resolvable by PrefixRegistry", async () => {
    const compiled = compileSchema([permTable]);
    const prefixRegistry = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(compiled, prefixRegistry);

    const metaRegistry = new MetaRegistry(REGISTRY_INPUT);
    const codec = metaRegistry.createCodec("perm", "v1");
    const encoded = codec.encode({
      role: "editor",
      action: "POST",
      resource: "dashboard",
    });

    const resolved = await prefixRegistry.resolveAddress(
      `perm:v1:${encoded.value}`,
    );

    expect(encoded).toEqual({
      indexId: "perm",
      versionId: "v1",
      value: 11,
    });
    expect(resolved).toEqual({
      prefix: "perm",
      versionId: "v1",
      index: 11,
      capacity: 18,
      shape: [3, 2, 3],
      refs: [
        { prefix: "role", versionId: "v1", capacity: 3 },
        { prefix: "action", versionId: "v1", capacity: 2 },
        { prefix: "resource", versionId: "v1", capacity: 3 },
      ],
      valid: true,
    });
  });
});
