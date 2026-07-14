// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * D-3 계약: capacity 곱셈 경로 간 일치.
 *
 * compileSchema의 capacity 곱셈 결과와 MetaRegistry의 WeightedIndex.size가 동일함을 검증한다.
 * 두 경로는 다른 입력(refs vs entries)에서 같은 값을 산출해야 한다.
 */
import { describe, expect, it } from 'vitest';
import {
  MetaRegistry,
  compileSchema,
  defineTable,
  syncSchemaToRegistry,
  InMemoryPrefixRegistry,
  type MetaRegistryInput,
} from 'index-meta';

describe('D-3: capacity 경로 일치', () => {
  it('3-dim 기본 케이스: compileSchema capacity === MetaRegistry codec.size', () => {
    const roleTable = defineTable('role', {
      source: { kind: { type: 'string_enum' as const } },
      versions: { v1: { capacity: 3 } },
    });
    const actionTable = defineTable('action', {
      source: { kind: { type: 'string_enum' as const } },
      versions: { v1: { capacity: 2 } },
    });
    const resourceTable = defineTable('resource', {
      source: { kind: { type: 'string_enum' as const } },
      versions: { v1: { capacity: 3 } },
    });
    const permTable = defineTable('perm', {
      dims: [roleTable, actionTable, resourceTable],
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

    const compiled = compileSchema([permTable]);
    const compositeSpec = compiled.getTable('perm');
    expect(compositeSpec).toBeDefined();
    expect(compositeSpec!.kind).toBe('composite');
    const compiledCapacity = compositeSpec!.versions.get('v1')!.capacity;

    const input: MetaRegistryInput = {
      dims: {
        role: { kind: { type: 'string_enum' }, snapshots: { v1: { entries: ['a', 'b', 'c'] } } },
        action: { kind: { type: 'string_enum' }, snapshots: { v1: { entries: ['GET', 'POST'] } } },
        resource: {
          kind: { type: 'string_enum' },
          snapshots: { v1: { entries: ['x', 'y', 'z'] } },
        },
      },
      indices: {
        perm: {
          dims: ['role', 'action', 'resource'],
          versions: { v1: { snapshots: { role: 'v1', action: 'v1', resource: 'v1' } } },
        },
      },
    };
    const registry = new MetaRegistry(input);
    const codec = registry.createCodec('perm', 'v1');

    // 핵심 계약: 두 경로의 capacity가 일치
    expect(compiledCapacity).toBe(codec.size);
    expect(compiledCapacity).toBe(3 * 2 * 3);
  });

  it('다중 버전: v1과 v2의 capacity가 각각 일치한다', () => {
    const dimTable = defineTable('dim', {
      source: { kind: { type: 'string_enum' as const } },
      versions: {
        v1: { capacity: 4 },
        v2: { capacity: 6 },
      },
    });
    const idxTable = defineTable('idx', {
      dims: [dimTable],
      versions: {
        v1: { refs: { dim: { prefix: 'dim', version: 'v1' } } },
        v2: { refs: { dim: { prefix: 'dim', version: 'v2' } } },
      },
    });

    const compiled = compileSchema([idxTable]);
    const spec = compiled.getTable('idx');

    const input: MetaRegistryInput = {
      dims: {
        dim: {
          kind: { type: 'string_enum' },
          snapshots: {
            v1: { entries: ['a', 'b', 'c', 'd'] },
            v2: { entries: ['a', 'b', 'c', 'd', 'e', 'f'] },
          },
        },
      },
      indices: {
        idx: {
          dims: ['dim'],
          versions: {
            v1: { snapshots: { dim: 'v1' } },
            v2: { snapshots: { dim: 'v2' } },
          },
        },
      },
    };
    const registry = new MetaRegistry(input);

    expect(spec!.versions.get('v1')!.capacity).toBe(registry.createCodec('idx', 'v1').size);
    expect(spec!.versions.get('v2')!.capacity).toBe(registry.createCodec('idx', 'v2').size);
  });

  it('고차원(6D): capacity 일치', () => {
    const sizes = [3, 4, 2, 5, 3, 2];
    const dimNames = ['a', 'b', 'c', 'd', 'e', 'f'];

    const leafTables = dimNames.map((name, i) =>
      defineTable(name, {
        source: { kind: { type: 'string_enum' as const } },
        versions: { v1: { capacity: sizes[i] } },
      }),
    );

    const compositeTable = defineTable('comp', {
      dims: leafTables,
      versions: {
        v1: {
          refs: Object.fromEntries(dimNames.map((name) => [name, { prefix: name, version: 'v1' }])),
        },
      },
    });

    const compiled = compileSchema([compositeTable]);
    const spec = compiled.getTable('comp');

    const input: MetaRegistryInput = {
      dims: Object.fromEntries(
        dimNames.map((name, i) => [
          name,
          {
            kind: { type: 'string_enum' as const },
            snapshots: {
              v1: { entries: Array.from({ length: sizes[i] }, (_, j) => `${name}${j}`) },
            },
          },
        ]),
      ),
      indices: {
        comp: {
          dims: dimNames,
          versions: {
            v1: {
              snapshots: Object.fromEntries(dimNames.map((name) => [name, 'v1'])),
            },
          },
        },
      },
    };
    const registry = new MetaRegistry(input);
    const codec = registry.createCodec('comp', 'v1');

    const expectedCapacity = sizes.reduce((p, s) => p * s, 1);
    expect(spec!.versions.get('v1')!.capacity).toBe(expectedCapacity);
    expect(codec.size).toBe(expectedCapacity);
  });

  it('PrefixRegistry sync 경로도 같은 capacity를 보존한다', async () => {
    const aTable = defineTable('a', {
      source: { kind: { type: 'string_enum' as const } },
      versions: { v1: { capacity: 5 } },
    });
    const bTable = defineTable('b', {
      source: { kind: { type: 'string_enum' as const } },
      versions: { v1: { capacity: 3 } },
    });
    const abTable = defineTable('ab', {
      dims: [aTable, bTable],
      versions: {
        v1: {
          refs: {
            a: { prefix: 'a', version: 'v1' },
            b: { prefix: 'b', version: 'v1' },
          },
        },
      },
    });

    const compiled = compileSchema([abTable]);
    const prefixRegistry = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(compiled, prefixRegistry);

    const record = await prefixRegistry.getRecord('ab', 'v1');
    const compSpec = compiled.getTable('ab');

    // compileSchema → PrefixRegistry → 같은 capacity
    expect(record!.capacity).toBe(compSpec!.versions.get('v1')!.capacity);
    expect(record!.capacity).toBe(15);
  });
});
