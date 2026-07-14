// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, expect, expectTypeOf, it } from 'vitest';
import * as publicApi from './index.js';
import {
  applySchemaDiff,
  compileSchema,
  defineTable,
  InMemoryPrefixRegistry,
  syncSchemaToRegistry,
  ValidationError,
} from './index.js';
import type { ApplySchemaDiffResult, PrefixRegistry } from './index.js';

const stringEnumKind = { type: 'string_enum' as const };

const role = (versions: Record<string, { capacity: number }> = { v1: { capacity: 8 } }) =>
  defineTable('role', {
    source: { kind: stringEnumKind },
    versions,
  });

const action = (versions: Record<string, { capacity: number }> = { v1: { capacity: 4 } }) =>
  defineTable('action', {
    source: { kind: stringEnumKind },
    versions,
  });

const resource = (versions: Record<string, { capacity: number }> = { v1: { capacity: 16 } }) =>
  defineTable('resource', {
    source: { kind: stringEnumKind },
    versions,
  });

const perm = (roleDef = role(), actionDef = action(), resourceDef = resource()) =>
  defineTable('perm', {
    dims: [roleDef, actionDef, resourceDef],
    versions: {
      v1: {
        refs: {
          role: { prefix: 'role', version: 'v1' },
          action: { prefix: 'action', version: 'v1' },
          resource: { prefix: 'resource', version: 'v1' },
        },
      },
    },
  });

describe('schema-sync public exports', () => {
  it('stays available from the package public surface', () => {
    expect(publicApi.syncSchemaToRegistry).toBe(syncSchemaToRegistry);
    expect(publicApi.applySchemaDiff).toBe(applySchemaDiff);

    const sample = {
      registered: [{ prefix: 'role', versionId: 'v2' }],
      updated: [{ prefix: 'perm', versionId: 'v1', previousCapacity: 32, capacity: 64 }],
      removedWarnings: ['legacy'],
    } satisfies ApplySchemaDiffResult;

    expect(sample.updated[0].previousCapacity).toBe(32);
    expectTypeOf<
      Awaited<ReturnType<typeof applySchemaDiff>>
    >().toEqualTypeOf<ApplySchemaDiffResult>();
  });
});

describe('syncSchemaToRegistry', () => {
  it('populates an empty registry with leaf and composite records', async () => {
    const schema = compileSchema([perm()]);
    const registry = new InMemoryPrefixRegistry();

    await syncSchemaToRegistry(schema, registry);

    expect(await registry.getCapacity('role', 'v1')).toBe(8);
    expect(await registry.getCapacity('action', 'v1')).toBe(4);
    expect(await registry.getCapacity('resource', 'v1')).toBe(16);
    expect(await registry.getCapacity('perm', 'v1')).toBe(8 * 4 * 16);
    expect(await registry.getRecord('perm', 'v1')).toEqual({
      prefix: 'perm',
      versionId: 'v1',
      capacity: 8 * 4 * 16,
      refs: [
        { prefix: 'role', versionId: 'v1', capacity: 8 },
        { prefix: 'action', versionId: 'v1', capacity: 4 },
        { prefix: 'resource', versionId: 'v1', capacity: 16 },
      ],
    });
  });

  it('propagates registry registration failures when sync is impossible', async () => {
    const schema = compileSchema([role()]);
    const registry: PrefixRegistry = {
      register: async () => {
        throw new ValidationError('forced register failure');
      },
      updateCapacity: async () => undefined,
      getCapacity: async () => null,
      getRecord: async () => null,
      listVersions: async () => [],
      listAll: async () => [],
      getDeps: async () => [],
      getTransitiveDeps: async () => [],
      getReverseRefs: async () => [],
      getShape: async () => null,
      resolveAddress: async () => null,
    };

    await expect(syncSchemaToRegistry(schema, registry)).rejects.toThrow('forced register failure');
  });
});

describe('applySchemaDiff', () => {
  it('registers added dims and composite entry tables', async () => {
    const roleV1 = role();
    const before = compileSchema([roleV1]);

    const actionV1 = action();
    const after = compileSchema([perm(roleV1, actionV1)]);
    const diff = after.diff(before);
    const registry = new InMemoryPrefixRegistry();

    await syncSchemaToRegistry(before, registry);
    const result = await applySchemaDiff(diff, after, registry);

    expect(result.registered).toEqual([
      { prefix: 'action', versionId: 'v1' },
      { prefix: 'resource', versionId: 'v1' },
      { prefix: 'perm', versionId: 'v1' },
    ]);
    expect(result.updated).toEqual([]);
    expect(await registry.getCapacity('action', 'v1')).toBe(4);
    expect(await registry.getCapacity('resource', 'v1')).toBe(16);
    expect(await registry.getCapacity('perm', 'v1')).toBe(8 * 4 * 16);
  });

  it('updates capacities and composite refs when a dim expands', async () => {
    const roleV1 = role({ v1: { capacity: 8 } });
    const actionV1 = action();
    const before = compileSchema([perm(roleV1, actionV1)]);
    const registry = new InMemoryPrefixRegistry();

    await syncSchemaToRegistry(before, registry);

    const roleExpanded = role({ v1: { capacity: 16 } });
    const after = compileSchema([perm(roleExpanded, actionV1)]);
    const diff = after.diff(before);
    const result = await applySchemaDiff(diff, after, registry);

    expect(result.updated).toEqual([
      { prefix: 'role', versionId: 'v1', previousCapacity: 8, capacity: 16 },
      { prefix: 'perm', versionId: 'v1', previousCapacity: 8 * 4 * 16, capacity: 16 * 4 * 16 },
    ]);
    expect(await registry.getCapacity('role', 'v1')).toBe(16);
    expect(await registry.getCapacity('perm', 'v1')).toBe(16 * 4 * 16);
    expect(await registry.getRecord('perm', 'v1')).toEqual({
      prefix: 'perm',
      versionId: 'v1',
      capacity: 16 * 4 * 16,
      refs: [
        { prefix: 'role', versionId: 'v1', capacity: 16 },
        { prefix: 'action', versionId: 'v1', capacity: 4 },
        { prefix: 'resource', versionId: 'v1', capacity: 16 },
      ],
    });
  });

  it('registers newly added versions without mutating existing ones', async () => {
    const before = compileSchema([role({ v1: { capacity: 8 } })]);
    const after = compileSchema([role({ v1: { capacity: 8 }, v2: { capacity: 16 } })]);
    const diff = after.diff(before);
    const registry = new InMemoryPrefixRegistry();

    await syncSchemaToRegistry(before, registry);
    const result = await applySchemaDiff(diff, after, registry);

    expect(result.registered).toEqual([{ prefix: 'role', versionId: 'v2' }]);
    expect(result.updated).toEqual([]);
    expect(await registry.getCapacity('role', 'v1')).toBe(8);
    expect(await registry.getCapacity('role', 'v2')).toBe(16);
  });

  it('throws when diff updates target registry records that do not exist', async () => {
    const before = compileSchema([role({ v1: { capacity: 8 } })]);
    const after = compileSchema([role({ v1: { capacity: 16 } })]);
    const diff = after.diff(before);
    const registry = new InMemoryPrefixRegistry();

    await expect(applySchemaDiff(diff, after, registry)).rejects.toThrow(
      'PrefixRegistry: "role/v1" not registered',
    );
  });
});
