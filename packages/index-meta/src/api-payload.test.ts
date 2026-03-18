import { describe, expect, it } from "vitest";
import type { EntryBatchPayload } from "./api-payload.js";
import { applyEntryBatch, validateEntryBatchPayload } from "./api-payload.js";
import { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
import { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
import { ValidationError } from "./errors.js";

const CREATED_AT = "2026-03-18T00:00:00.000Z";

function makePayload(overrides: Partial<EntryBatchPayload> = {}): EntryBatchPayload {
  return {
    capacity: overrides.capacity ?? 8,
    entries: overrides.entries ?? { "1": "admin", "4": "editor" },
  };
}

describe("api-payload public exports", () => {
  it("exposes the EntryBatchPayload contract", () => {
    const payload = {
      capacity: 4,
      entries: { "2": "editor" },
    } satisfies EntryBatchPayload;

    expect(payload).toEqual({
      capacity: 4,
      entries: { "2": "editor" },
    });
  });
});

describe("validateEntryBatchPayload", () => {
  it("accepts a valid sparse payload", () => {
    const payload = makePayload({
      capacity: 8,
      entries: {
        "1": "admin",
        "4": "editor",
        "8": "viewer",
      },
    });

    expect(() => validateEntryBatchPayload(payload)).not.toThrow();
  });

  it("accepts reserved token values", () => {
    const payload = makePayload({
      capacity: 4,
      entries: {
        "1": "_",
        "2": "~",
        "3": "?",
        "4": "NaN",
      },
    });

    expect(() => validateEntryBatchPayload(payload)).not.toThrow();
  });

  it("accepts an empty entries object", () => {
    expect(() =>
      validateEntryBatchPayload({
        capacity: 4,
        entries: {},
      })
    ).not.toThrow();
  });

  it.each([
    [
      {
        capacity: 4,
        entries: { "5": "viewer" },
      },
      'EntryBatchPayload: position "5" is out of range [1, 4]',
    ],
    [
      {
        capacity: 4,
        entries: { "-1": "viewer" },
      },
      'EntryBatchPayload: position "-1" is out of range [1, 4]',
    ],
    [
      {
        capacity: 4,
        entries: { "1.5": "viewer" },
      },
      'EntryBatchPayload: position "1.5" is out of range [1, 4]',
    ],
  ] satisfies ReadonlyArray<[EntryBatchPayload, string]>)(
    "rejects invalid position payload %o",
    (payload, message) => {
      expect(() => validateEntryBatchPayload(payload)).toThrowError(message);
    },
  );

  it("rejects empty string values", () => {
    expect(() =>
      validateEntryBatchPayload({
        capacity: 4,
        entries: { "1": "" },
      })
    ).toThrow(ValidationError);
  });
});

describe("applyEntryBatch", () => {
  it("registers registry state and inserts sparse entries in position order", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();
    const payload = makePayload({
      entries: {
        "7": "viewer",
        "1": "admin",
        "4": "editor",
      },
    });

    await applyEntryBatch("role", "v1", payload, registry, store, CREATED_AT);

    expect(await registry.getRecord("role", "v1")).toEqual({
      prefix: "role",
      versionId: "v1",
      capacity: 8,
    });
    expect(await store.getSchemaVersion("role", "v1")).toEqual({
      prefix: "role",
      versionId: "v1",
      capacity: 8,
      createdAt: CREATED_AT,
    });
    expect(await store.getEntries("role", "v1")).toEqual([
      {
        prefix: "role",
        versionId: "v1",
        position: 1,
        value: "admin",
        createdAt: CREATED_AT,
      },
      {
        prefix: "role",
        versionId: "v1",
        position: 4,
        value: "editor",
        createdAt: CREATED_AT,
      },
      {
        prefix: "role",
        versionId: "v1",
        position: 7,
        value: "viewer",
        createdAt: CREATED_AT,
      },
    ]);
  });

  it("supports empty entry batches while creating registry and schema version state", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await applyEntryBatch(
      "perm",
      "v2",
      {
        capacity: 16,
        entries: {},
      },
      registry,
      store,
      CREATED_AT,
    );

    expect(await registry.getCapacity("perm", "v2")).toBe(16);
    expect(await store.getSchemaVersion("perm", "v2")).toEqual({
      prefix: "perm",
      versionId: "v2",
      capacity: 16,
      createdAt: CREATED_AT,
    });
    expect(await store.getEntries("perm", "v2")).toEqual([]);
  });

  it("keeps existing positions untouched and only inserts missing entries", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await registry.register({
      prefix: "role",
      versionId: "v1",
      capacity: 8,
    });
    await store.insertSchemaVersion({
      prefix: "role",
      versionId: "v1",
      capacity: 8,
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    await store.insertEntry({
      prefix: "role",
      versionId: "v1",
      position: 1,
      value: "seed-admin",
      createdAt: "2026-03-01T00:00:00.000Z",
    });

    await applyEntryBatch(
      "role",
      "v1",
      makePayload({
        entries: {
          "1": "payload-admin",
          "3": "viewer",
        },
      }),
      registry,
      store,
      CREATED_AT,
    );

    expect(await registry.listVersions("role")).toHaveLength(1);
    expect(await store.getEntries("role", "v1")).toEqual([
      {
        prefix: "role",
        versionId: "v1",
        position: 1,
        value: "seed-admin",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        prefix: "role",
        versionId: "v1",
        position: 3,
        value: "viewer",
        createdAt: CREATED_AT,
      },
    ]);
  });

  it("rejects registry capacity mismatches before writing to the store", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store = new InMemoryIndexMetaStore();

    await registry.register({
      prefix: "role",
      versionId: "v1",
      capacity: 4,
    });

    await expect(
      applyEntryBatch(
        "role",
        "v1",
        makePayload({
          capacity: 8,
          entries: { "1": "admin" },
        }),
        registry,
        store,
        CREATED_AT,
      ),
    ).rejects.toThrowError(
      'applyEntryBatch: capacity mismatch for "role/v1" \u2014 registry has 4, payload has 8',
    );

    expect(await store.getSchemaVersion("role", "v1")).toBeNull();
    expect(await store.getEntries("role", "v1")).toEqual([]);
  });
});
