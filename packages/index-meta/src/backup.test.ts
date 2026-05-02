// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, expect, expectTypeOf, it } from "vitest";
import * as publicApi from "./index.js";
import {
  exportVersion,
  importVersion,
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
} from "./index.js";
import type { PrefixRegistryRecord, VersionBackup } from "./index.js";

const CREATED_AT = "2026-03-01T00:00:00.000Z";
const EXPORTED_AT = "2026-03-18T00:00:00.000Z";

const COMPOSITE_REFS = [
  { prefix: "role", versionId: "role-s2", capacity: 8 },
  { prefix: "action", versionId: "action-s1", capacity: 4 },
  { prefix: "resource", versionId: "resource-s3", capacity: 16 },
] as const satisfies NonNullable<PrefixRegistryRecord["refs"]>;

type SeedEntry = {
  position: number;
  value: VersionBackup["entries"][string];
};

function makeBackup(overrides: Partial<VersionBackup> = {}): VersionBackup {
  return {
    format: "index-meta/v1",
    exportedAt: overrides.exportedAt ?? EXPORTED_AT,
    prefix: overrides.prefix ?? "content",
    versionId: overrides.versionId ?? "v1",
    capacity: overrides.capacity ?? 8,
    ...(overrides.refs ? { refs: overrides.refs } : {}),
    entries: overrides.entries ?? { "1": 0, "3": 4, "8": 8 },
  };
}

async function seedVersion(
  registry: InMemoryPrefixRegistry,
  store: InMemoryIndexMetaStore,
  record: PrefixRegistryRecord,
  entries: readonly SeedEntry[] = [],
  createdAt = CREATED_AT,
): Promise<void> {
  await registry.register(record);
  await store.insertSchemaVersion({
    prefix: record.prefix,
    versionId: record.versionId,
    capacity: record.capacity,
    createdAt,
  });

  for (const entry of entries) {
    await store.insertEntry({
      prefix: record.prefix,
      versionId: record.versionId,
      position: entry.position,
      value: entry.value,
      createdAt,
    });
  }
}

describe("backup public exports", () => {
  it("stays available from the package public surface", () => {
    expect(publicApi.exportVersion).toBe(exportVersion);
    expect(publicApi.importVersion).toBe(importVersion);

    const sample = makeBackup({
      prefix: "perm",
      versionId: "v3",
      capacity: 8 * 4 * 16,
      refs: COMPOSITE_REFS,
      entries: {},
    }) satisfies VersionBackup;

    expect(sample.refs).toEqual(COMPOSITE_REFS);
    expect(sample.entries).toEqual({});
    expectTypeOf<Awaited<ReturnType<typeof exportVersion>>>().toEqualTypeOf<VersionBackup>();
  });
});

describe("exportVersion", () => {
  it("exports composite versions with multi-dim refs intact", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await seedVersion(registry, store, {
      prefix: "perm",
      versionId: "v3",
      capacity: 8 * 4 * 16,
      refs: COMPOSITE_REFS,
    });

    await expect(exportVersion("perm", "v3", registry, store, EXPORTED_AT)).resolves.toEqual(
      makeBackup({
        prefix: "perm",
        versionId: "v3",
        capacity: 8 * 4 * 16,
        refs: COMPOSITE_REFS,
        entries: {},
      }),
    );
  });

  it("rejects unknown prefix/version pairs", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await expect(exportVersion("missing", "v1", registry, store, EXPORTED_AT)).rejects.toThrow(
      'exportVersion: "missing/v1" not found in PrefixRegistry',
    );
  });
});

describe("importVersion", () => {
  it("round-trips numeric cross-index entries without coercing them to strings", async () => {
    const sourceRegistry = new InMemoryPrefixRegistry();
    const sourceStore = new InMemoryIndexMetaStore();

    await seedVersion(
      sourceRegistry,
      sourceStore,
      { prefix: "content", versionId: "v1", capacity: 8 },
      [
        { position: 1, value: 0 },
        { position: 3, value: 4 },
        { position: 8, value: 8 },
      ],
    );

    const backup = await exportVersion("content", "v1", sourceRegistry, sourceStore, EXPORTED_AT);
    const restoredRegistry = new InMemoryPrefixRegistry();
    const restoredStore = new InMemoryIndexMetaStore();

    await importVersion(backup, restoredRegistry, restoredStore);

    expect(backup.entries).toEqual({ "1": 0, "3": 4, "8": 8 });
    expect(await restoredStore.getEntries("content", "v1")).toEqual([
      {
        prefix: "content",
        versionId: "v1",
        position: 1,
        value: 0,
        createdAt: EXPORTED_AT,
      },
      {
        prefix: "content",
        versionId: "v1",
        position: 3,
        value: 4,
        createdAt: EXPORTED_AT,
      },
      {
        prefix: "content",
        versionId: "v1",
        position: 8,
        value: 8,
        createdAt: EXPORTED_AT,
      },
    ]);
    expect(await restoredStore.getSchemaVersion("content", "v1")).toEqual({
      prefix: "content",
      versionId: "v1",
      capacity: 8,
      createdAt: EXPORTED_AT,
    });
    expect(await exportVersion("content", "v1", restoredRegistry, restoredStore, EXPORTED_AT)).toEqual(backup);
  });

  it("restores composite refs so dependency graphs survive import", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();
    const backup = makeBackup({
      prefix: "perm",
      versionId: "v3",
      capacity: 8 * 4 * 16,
      refs: COMPOSITE_REFS,
      entries: {},
    });

    await importVersion(backup, registry, store);

    expect(await registry.getRecord("perm", "v3")).toEqual({
      prefix: "perm",
      versionId: "v3",
      capacity: 8 * 4 * 16,
      refs: COMPOSITE_REFS,
    });
    expect(await store.getSchemaVersion("perm", "v3")).toEqual({
      prefix: "perm",
      versionId: "v3",
      capacity: 8 * 4 * 16,
      createdAt: EXPORTED_AT,
    });
    expect(await store.getEntries("perm", "v3")).toEqual([]);
  });

  it("rejects unknown backup formats", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();
    const legacyBackup = {
      ...makeBackup(),
      format: "index-meta/legacy",
    } as unknown as VersionBackup;

    await expect(importVersion(legacyBackup, registry, store)).rejects.toThrow(
      'importVersion: unknown format "index-meta/legacy"',
    );
  });

  it("fails fast on duplicate registry imports without mutating the store", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await registry.register({
      prefix: "content",
      versionId: "v1",
      capacity: 8,
    });

    await expect(importVersion(makeBackup(), registry, store)).rejects.toThrow(
      'PrefixRegistry: "content/v1" already registered',
    );
    expect(await store.getSchemaVersion("content", "v1")).toBeNull();
    expect(await store.getEntries("content", "v1")).toEqual([]);
  });

  it("surfaces schema-version conflicts after registering the prefix", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await store.insertSchemaVersion({
      prefix: "content",
      versionId: "v1",
      capacity: 8,
      createdAt: CREATED_AT,
    });

    await expect(importVersion(makeBackup(), registry, store)).rejects.toThrow(
      'SchemaVersion already exists: "content/v1"',
    );
    expect(await registry.getRecord("content", "v1")).toEqual({
      prefix: "content",
      versionId: "v1",
      capacity: 8,
    });
    expect(await store.getEntries("content", "v1")).toEqual([]);
  });
});
