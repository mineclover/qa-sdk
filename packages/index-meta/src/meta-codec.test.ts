// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect } from 'vitest';
import { MetaCodec, validateDecodeMap } from './meta-codec.js';
import { MetaRegistry } from './meta-registry.js';
import { MetaResolver } from './meta-resolver.js';
import { EntryNotFoundError, ValidationError } from './errors.js';
import type { DecodeMap } from './types.js';

// ── 픽스처 ──────────────────────────────────────────────────────────────────

/** 3×3×3 perm index (string_enum + number_enum) */
const permMap = (): DecodeMap => ({
  indexId: 'perm',
  versionId: 'v1',
  shape: [3, 3, 3],
  size: 27,
  dims: [
    {
      dimId: 'role',
      snapshotId: 'sv1',
      kind: { type: 'string_enum' },
      entries: ['admin', 'editor', 'viewer'],
    },
    {
      dimId: 'action',
      snapshotId: 'sv1',
      kind: { type: 'string_enum' },
      entries: ['read', 'write', 'delete'],
    },
    { dimId: 'resource', snapshotId: 'sv1', kind: { type: 'number_enum' }, entries: [10, 20, 30] },
  ],
});

/** 단일 dim index (number_enum) */
const singleDimMap = (): DecodeMap => ({
  indexId: 'tier',
  versionId: 'tv1',
  shape: [4],
  size: 4,
  dims: [
    { dimId: 'level', snapshotId: 'lv1', kind: { type: 'number_enum' }, entries: [0, 1, 2, 3] },
  ],
});

// ── 생성 ──────────────────────────────────────────────────────────────────────

describe('MetaCodec 생성', () => {
  it('DecodeMap으로 직접 생성할 수 있다', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.indexId).toBe('perm');
    expect(codec.versionId).toBe('v1');
    expect(codec.size).toBe(27);
    expect(codec.shape).toEqual([3, 3, 3]);
  });

  it('MetaRegistry.createCodec()으로 생성할 수 있다', () => {
    const reg = new MetaRegistry({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['admin', 'editor'] } },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { iv1: { snapshots: { role: 'v1' } } } },
      },
    });
    const codec = reg.createCodec('perm', 'iv1');
    expect(codec.indexId).toBe('perm');
    expect(codec.versionId).toBe('iv1');
    expect(codec.size).toBe(2);
  });

  it('MetaResolver.getDecodeMap() → new MetaCodec()로 독립 생성할 수 있다', () => {
    const reg = new MetaRegistry({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['a', 'b', 'c'] } },
        },
      },
      indices: {
        idx: { dims: ['role'], versions: { iv1: { snapshots: { role: 'v1' } } } },
      },
    });
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('idx', 'iv1');
    const codec = new MetaCodec(map);

    expect(codec.indexId).toBe('idx');
    expect(codec.size).toBe(3);
  });
});

// ── encode / decode round-trip ──────────────────────────────────────────────

describe('encode / decode', () => {
  it('encode → decode round-trip: 원래 entity ID를 복원한다', () => {
    const codec = new MetaCodec(permMap());
    const vv = codec.encode({ role: 'admin', action: 'write', resource: 20 });

    expect(vv.indexId).toBe('perm');
    expect(vv.versionId).toBe('v1');
    expect(typeof vv.value).toBe('number');

    const ids = codec.decode(vv);
    expect(ids).toEqual({ role: 'admin', action: 'write', resource: 20 });
  });

  it('number_enum entity ID도 정확하게 encode/decode된다', () => {
    const codec = new MetaCodec(singleDimMap());

    for (const level of [0, 1, 2, 3]) {
      const vv = codec.encode({ level });
      expect(codec.decode(vv)).toEqual({ level });
    }
  });

  it('서로 다른 좌표는 서로 다른 value를 생성한다 (bijection)', () => {
    const codec = new MetaCodec(permMap());
    const seen = new Set<number>();

    for (const role of ['admin', 'editor', 'viewer']) {
      for (const action of ['read', 'write', 'delete']) {
        for (const resource of [10, 20, 30]) {
          const { value } = codec.encode({ role, action, resource });
          expect(seen.has(value)).toBe(false);
          seen.add(value);
        }
      }
    }
    expect(seen.size).toBe(27);
  });

  it('value 범위는 [0, size-1]이다', () => {
    const codec = new MetaCodec(permMap());
    const values: number[] = [];

    for (const role of ['admin', 'editor', 'viewer']) {
      for (const action of ['read', 'write', 'delete']) {
        for (const resource of [10, 20, 30]) {
          values.push(codec.encode({ role, action, resource }).value);
        }
      }
    }
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(26);
  });
});

// ── decodeValue ─────────────────────────────────────────────────────────────

describe('decodeValue', () => {
  it('value만으로 decode한다 (indexId/versionId 검증 없음)', () => {
    const codec = new MetaCodec(permMap());
    const vv = codec.encode({ role: 'viewer', action: 'delete', resource: 30 });
    const ids = codec.decodeValue(vv.value);

    expect(ids).toEqual({ role: 'viewer', action: 'delete', resource: 30 });
  });

  it('전체 value range를 순회하며 decodeValue가 유효한 entity를 반환한다 (단일 dim)', () => {
    const codec = new MetaCodec(singleDimMap());
    for (let v = 0; v < codec.size; v++) {
      const ids = codec.decodeValue(v);
      expect(typeof ids.level).toBe('number');
    }
  });

  it('다차원 전체 value range를 decodeValue로 순회하면 encode와 역대응한다', () => {
    const codec = new MetaCodec(permMap());
    const roles = ['admin', 'editor', 'viewer'];
    const actions = ['read', 'write', 'delete'];
    const resources = [10, 20, 30];

    for (let v = 0; v < codec.size; v++) {
      const ids = codec.decodeValue(v);
      // decode된 entity가 유효한 값인지
      expect(roles).toContain(ids.role);
      expect(actions).toContain(ids.action);
      expect(resources).toContain(ids.resource);
      // re-encode하면 원래 value와 동일한지
      expect(codec.encode(ids).value).toBe(v);
    }
  });
});

// ── 에러 ──────────────────────────────────────────────────────────────────────

describe('에러 처리', () => {
  it('존재하지 않는 entity ID는 EntryNotFoundError', () => {
    const codec = new MetaCodec(permMap());
    expect(() => codec.encode({ role: 'superadmin', action: 'read', resource: 10 })).toThrow(
      EntryNotFoundError,
    );
  });

  it('dim 누락 시 ValidationError', () => {
    const codec = new MetaCodec(permMap());
    expect(() => codec.encode({ role: 'admin', action: 'read' })).toThrow(ValidationError);
  });

  it('decode: indexId 불일치 시 ValidationError', () => {
    const codec = new MetaCodec(permMap());
    expect(() => codec.decode({ indexId: 'wrong', versionId: 'v1', value: 0 })).toThrow(
      ValidationError,
    );
  });

  it('decode: versionId 불일치 시 ValidationError', () => {
    const codec = new MetaCodec(permMap());
    expect(() => codec.decode({ indexId: 'perm', versionId: 'wrong', value: 0 })).toThrow(
      ValidationError,
    );
  });
});

// ── 불변성 ──────────────────────────────────────────────────────────────────

describe('불변성', () => {
  it('decode 반환값이 frozen이다', () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decode(codec.encode({ role: 'admin', action: 'read', resource: 10 }));
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('decodeValue 반환값도 frozen이다', () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decodeValue(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('frozen 객체 변조 시 TypeError', () => {
    const codec = new MetaCodec(permMap());
    const result = codec.decode(codec.encode({ role: 'admin', action: 'read', resource: 10 }));
    expect(() => {
      (result as Record<string, unknown>)['role'] = 'hacked';
    }).toThrow(TypeError);
  });
});

// ── toDecodeMap ──────────────────────────────────────────────────────────────

describe('toDecodeMap', () => {
  it('deep clone을 반환한다', () => {
    const codec = new MetaCodec(permMap());
    const map1 = codec.toDecodeMap();
    const map2 = codec.toDecodeMap();

    expect(map1).toEqual(map2);
    expect(map1).not.toBe(map2);
    expect(map1.dims).not.toBe(map2.dims);
  });

  it('반환된 DecodeMap으로 새 코덱을 만들면 동일하게 동작한다', () => {
    const codec1 = new MetaCodec(permMap());
    const codec2 = new MetaCodec(codec1.toDecodeMap());

    const entityIds = { role: 'editor', action: 'write', resource: 20 };
    expect(codec2.encode(entityIds)).toEqual(codec1.encode(entityIds));
    expect(codec2.decode(codec1.encode(entityIds))).toEqual(entityIds);
  });
});

// ── matchRanges ──────────────────────────────────────────────────────────────
//
// 시나리오: SaaS 권한 시스템 DB 쿼리 최적화
//
// DB에 VersionedValue.value가 PK로 저장되어 있을 때,
// "editor의 모든 권한" 같은 부분 조건을 DB full scan + decode 없이
// value BETWEEN 범위 쿼리로 처리한다.
//
//   permissions 테이블
//   ┌───────┬──────────────────────────────────────┐
//   │ value │ decoded                              │
//   ├───────┼──────────────────────────────────────┤
//   │  0-8  │ role=admin  (action × resource 전체) │
//   │  9-17 │ role=editor                          │
//   │ 18-26 │ role=viewer                          │
//   └───────┴──────────────────────────────────────┘
//
//   SELECT * FROM permissions WHERE value BETWEEN 9 AND 17
//   → role=editor인 권한 전체를 인덱스 스캔으로 조회

describe('matchRanges', () => {
  // 픽스처: role × action × resource (3×3×3 = 27)
  // role:     admin(1), editor(2), viewer(3)        weights: 9
  // action:   read(1),  write(2),  delete(3)        weights: 3
  // resource: 10(1),    20(2),     30(3)            weights: 1

  it('전체 와일드카드 → [[0, size-1]]', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.matchRanges({})).toEqual([[0, 26]]);
    expect(codec.matchRanges({ role: null, action: null, resource: null })).toEqual([[0, 26]]);
  });

  it('첫 번째 dim 고정 → 연속된 단일 구간', () => {
    const codec = new MetaCodec(permMap());
    // role=admin(coord=1): (1-1)*9 = 0 → [0, 8]
    expect(codec.matchRanges({ role: 'admin' })).toEqual([[0, 8]]);
    // role=editor(coord=2): (2-1)*9 = 9 → [9, 17]
    expect(codec.matchRanges({ role: 'editor' })).toEqual([[9, 17]]);
    // role=viewer(coord=3): (3-1)*9 = 18 → [18, 26]
    expect(codec.matchRanges({ role: 'viewer' })).toEqual([[18, 26]]);
  });

  it('중간 dim 고정 → 비연속 구간 (role마다 블록 분리)', () => {
    const codec = new MetaCodec(permMap());
    // action=write(coord=2): 각 role 블록에서 (2-1)*3=3 오프셋
    // role=admin:  [3, 5], role=editor: [12, 14], role=viewer: [21, 23]
    expect(codec.matchRanges({ action: 'write' })).toEqual([
      [3, 5],
      [12, 14],
      [21, 23],
    ]);
  });

  it('마지막 dim 고정 → 단원소 구간들 (가장 파편화)', () => {
    const codec = new MetaCodec(permMap());
    // resource=30(coord=3): 오프셋 2, 각 (role, action) 조합마다 하나
    // (admin,read)=2, (admin,write)=5, (admin,delete)=8
    // (editor,read)=11, (editor,write)=14, (editor,delete)=17
    // (viewer,read)=20, (viewer,write)=23, (viewer,delete)=26
    expect(codec.matchRanges({ resource: 30 })).toEqual([
      [2, 2],
      [5, 5],
      [8, 8],
      [11, 11],
      [14, 14],
      [17, 17],
      [20, 20],
      [23, 23],
      [26, 26],
    ]);
  });

  it('두 dim 고정 → 연속된 단일 구간 (or 단원소)', () => {
    const codec = new MetaCodec(permMap());
    // role=editor(9) + action=write(3) = base 12, resource wildcard → [12, 14]
    expect(codec.matchRanges({ role: 'editor', action: 'write' })).toEqual([[12, 14]]);
    // role=viewer(18) + resource=30(2) = 20, action wildcard → [20,20],[23,23],[26,26]
    expect(codec.matchRanges({ role: 'viewer', resource: 30 })).toEqual([
      [20, 20],
      [23, 23],
      [26, 26],
    ]);
  });

  it('세 dim 모두 고정 → 단일 값 (encode와 일치)', () => {
    const codec = new MetaCodec(permMap());
    const cases: [Record<string, string | number>, number][] = [
      [{ role: 'admin', action: 'read', resource: 10 }, 0],
      [{ role: 'admin', action: 'delete', resource: 30 }, 8],
      [{ role: 'editor', action: 'write', resource: 20 }, 13],
      [{ role: 'viewer', action: 'delete', resource: 30 }, 26],
    ];
    for (const [ids, expectedValue] of cases) {
      expect(codec.matchRanges(ids)).toEqual([[expectedValue, expectedValue]]);
      expect(codec.encode(ids).value).toBe(expectedValue);
    }
  });

  it('matchRanges 범위 내 value는 모두 패턴과 매칭된다 (진위 검증)', () => {
    const codec = new MetaCodec(permMap());
    const pattern = { role: 'editor', action: null as null, resource: null as null };
    const ranges = codec.matchRanges(pattern);

    for (const [from, to] of ranges) {
      for (let v = from; v <= to; v++) {
        const ids = codec.decodeValue(v);
        expect(ids.role).toBe('editor');
      }
    }
  });

  it('matchRanges 범위 밖 value는 패턴과 매칭되지 않는다 (반례 검증)', () => {
    const codec = new MetaCodec(permMap());
    const pattern = { action: 'delete' };
    const ranges = codec.matchRanges(pattern);
    const inRange = new Set(
      ranges.flatMap(([f, t]) => Array.from({ length: t - f + 1 }, (_, i) => f + i)),
    );

    for (let v = 0; v < codec.size; v++) {
      const ids = codec.decodeValue(v);
      if (ids.action === 'delete') {
        expect(inRange.has(v)).toBe(true);
      } else {
        expect(inRange.has(v)).toBe(false);
      }
    }
  });

  it('단일 dim codec에서도 동작한다', () => {
    const codec = new MetaCodec(singleDimMap());
    expect(codec.matchRanges({})).toEqual([[0, 3]]);
    expect(codec.matchRanges({ level: 2 })).toEqual([[2, 2]]); // level=2 → coord=3 → value=2
    expect(codec.matchRanges({ level: 0 })).toEqual([[0, 0]]); // level=0 → coord=1 → value=0
  });

  it('존재하지 않는 entity ID → EntryNotFoundError', () => {
    const codec = new MetaCodec(permMap());
    expect(() => codec.matchRanges({ role: 'superadmin' })).toThrow(EntryNotFoundError);
    expect(() => codec.matchRanges({ resource: 999 })).toThrow(EntryNotFoundError);
  });

  it('지정된 dim이 없는 키는 무시된다 (와일드카드 처리)', () => {
    const codec = new MetaCodec(permMap());
    // partial에 이 codec에 없는 dim 키가 있어도 무시
    const r1 = codec.matchRanges({ role: 'admin' });
    const r2 = codec.matchRanges({ role: 'admin', unknownDim: 'xyz' } as Record<
      string,
      string | null
    >);
    expect(r1).toEqual(r2);
  });
});

// ── 독립 운용 (MetaRegistry 없이) ───────────────────────────────────────────

describe('독립 운용', () => {
  it('JSON으로 전송된 DecodeMap으로 코덱을 생성해 encode/decode할 수 있다', () => {
    const codec1 = new MetaCodec(permMap());
    const vv = codec1.encode({ role: 'viewer', action: 'delete', resource: 30 });

    // 네트워크 전송 시뮬레이션
    const json = JSON.stringify(codec1.toDecodeMap());
    const received: DecodeMap = JSON.parse(json);

    // 수신 측에서 MetaRegistry 없이 독립 decode
    const codec2 = new MetaCodec(received);
    expect(codec2.decode(vv)).toEqual({ role: 'viewer', action: 'delete', resource: 30 });

    // 수신 측에서 독립 encode → 원본과 동일한 value 생성
    const vv2 = codec2.encode({ role: 'viewer', action: 'delete', resource: 30 });
    expect(vv2).toEqual(vv);
  });

  it('서로 다른 index version에 대한 독립 코덱을 각각 만들 수 있다', () => {
    const v1Map: DecodeMap = {
      indexId: 'perm',
      versionId: 'v1',
      shape: [3],
      size: 3,
      dims: [
        {
          dimId: 'role',
          snapshotId: 'sv1',
          kind: { type: 'string_enum' },
          entries: ['admin', 'editor', 'viewer'],
        },
      ],
    };
    const v2Map: DecodeMap = {
      indexId: 'perm',
      versionId: 'v2',
      shape: [4],
      size: 4,
      dims: [
        {
          dimId: 'role',
          snapshotId: 'sv2',
          kind: { type: 'string_enum' },
          entries: ['admin', 'editor', 'viewer', 'guest'],
        },
      ],
    };

    const v1 = new MetaCodec(v1Map);
    const v2 = new MetaCodec(v2Map);

    // v1 encode → v1 decode
    const vv1 = v1.encode({ role: 'viewer' });
    expect(v1.decode(vv1)).toEqual({ role: 'viewer' });

    // 동일 entity로 v2 encode → v2 decode (cross-version migration)
    const vv2 = v2.encode({ role: 'viewer' });
    expect(v2.decode(vv2)).toEqual({ role: 'viewer' });

    // v2에만 있는 guest
    expect(() => v1.encode({ role: 'guest' })).toThrow(EntryNotFoundError);
    expect(v2.decode(v2.encode({ role: 'guest' }))).toEqual({ role: 'guest' });
  });

  it('같은 registry에서 생성한 여러 codec이 독립적으로 동작한다', () => {
    const reg = new MetaRegistry({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['admin', 'editor', 'viewer'] },
            v2: { entries: ['admin', 'editor', 'viewer', 'guest'] },
          },
        },
        action: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['read', 'write'] } },
        },
      },
      indices: {
        perm: {
          dims: ['role', 'action'],
          versions: {
            iv1: { snapshots: { role: 'v1', action: 'v1' } },
            iv2: { snapshots: { role: 'v2', action: 'v1' } },
          },
        },
      },
    });

    const iv1 = reg.createCodec('perm', 'iv1');
    const iv2 = reg.createCodec('perm', 'iv2');

    // 각 codec이 자기 version에서 독립 동작
    expect(iv1.size).toBe(6); // 3×2
    expect(iv2.size).toBe(8); // 4×2

    const vv1 = iv1.encode({ role: 'admin', action: 'read' });
    const vv2 = iv2.encode({ role: 'guest', action: 'read' });

    expect(iv1.decode(vv1)).toEqual({ role: 'admin', action: 'read' });
    expect(iv2.decode(vv2)).toEqual({ role: 'guest', action: 'read' });

    // cross-version decode 시도 시 ValidationError
    expect(() => iv1.decode(vv2)).toThrow(ValidationError);
  });

  it('decode → re-encode 패턴으로 version 이동이 가능하다', () => {
    const v1Map: DecodeMap = {
      indexId: 'idx',
      versionId: 'v1',
      shape: [2, 2],
      size: 4,
      dims: [
        { dimId: 'a', snapshotId: 's1', kind: { type: 'string_enum' }, entries: ['x', 'y'] },
        { dimId: 'b', snapshotId: 's1', kind: { type: 'string_enum' }, entries: ['p', 'q'] },
      ],
    };
    const v2Map: DecodeMap = {
      indexId: 'idx',
      versionId: 'v2',
      shape: [3, 2],
      size: 6,
      dims: [
        { dimId: 'a', snapshotId: 's2', kind: { type: 'string_enum' }, entries: ['x', 'y', 'z'] },
        { dimId: 'b', snapshotId: 's1', kind: { type: 'string_enum' }, entries: ['p', 'q'] },
      ],
    };

    const v1 = new MetaCodec(v1Map);
    const v2 = new MetaCodec(v2Map);

    // v1 decode → entity IDs 추출 → v2 re-encode
    const v1vv = v1.encode({ a: 'y', b: 'q' });
    const entityIds = v1.decode(v1vv);
    const v2vv = v2.encode(entityIds);

    expect(v2.decode(v2vv)).toEqual({ a: 'y', b: 'q' });
    // version이 다르므로 value도 다를 수 있다
    expect(v2vv.versionId).toBe('v2');
  });
});

// ── validateDecodeMap ─────────────────────────────────────────────────────────

describe('validateDecodeMap', () => {
  const validMap = (): DecodeMap => ({
    indexId: 'perm',
    versionId: 'v1',
    shape: [3, 2],
    size: 6,
    dims: [
      {
        dimId: 'role',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['admin', 'editor', 'viewer'],
      },
      {
        dimId: 'action',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['read', 'write'],
      },
    ],
  });

  it('유효한 DecodeMap은 검증을 통과한다', () => {
    expect(() => validateDecodeMap(validMap())).not.toThrow();
  });

  it('빈 indexId는 ValidationError', () => {
    const map = validMap();
    map.indexId = '';
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('빈 versionId는 ValidationError', () => {
    const map = validMap();
    map.versionId = '';
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('shape.length !== dims.length이면 ValidationError', () => {
    const map = validMap();
    map.shape = [3, 2, 1]; // 3 elements but only 2 dims
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('shape[i] !== entries.length이면 ValidationError', () => {
    const map = validMap();
    map.shape[0] = 5; // says 5 but entries has 3
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('size !== product of shape이면 ValidationError', () => {
    const map = validMap();
    map.size = 999;
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('중복 dimId는 ValidationError', () => {
    const map = validMap();
    map.dims[1] = {
      dimId: 'role',
      snapshotId: 'sv2',
      kind: { type: 'string_enum' },
      entries: ['x', 'y'],
    };
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('빈 dims 배열은 ValidationError', () => {
    const map = validMap();
    map.dims = [];
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });

  it('shape[i] <= 0이면 ValidationError', () => {
    const map: DecodeMap = {
      indexId: 'test',
      versionId: 'v1',
      shape: [0],
      size: 0,
      dims: [{ dimId: 'a', snapshotId: 's1', kind: { type: 'string_enum' }, entries: [] }],
    };
    expect(() => validateDecodeMap(map)).toThrow(ValidationError);
  });
});

// ── strides ──────────────────────────────────────────────────────────────────
//
// API 서버에서 수동 stride 계산(`const EVT_SVC_STRIDE = 7 * 2;`)을 제거한다.
// codec.strides[i]로 "i번째 dim의 좌표가 1 증가하면 value가 몇 변하는지" 참조.

describe('strides', () => {
  it('shape [3, 3, 3] → strides [9, 3, 1]', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.strides).toEqual([9, 3, 1]);
  });

  it('shape과 같은 순서이며 strides[last] === 1', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.strides[codec.strides.length - 1]).toBe(1);
  });

  it('strides[0] = product(shape[1:])', () => {
    const codec = new MetaCodec(permMap());
    // shape [3, 3, 3] → strides[0] = 3*3 = 9
    expect(codec.strides[0]).toBe(3 * 3);
  });

  it('stride를 이용해 특정 dim의 주소 변화량을 확인할 수 있다', () => {
    const codec = new MetaCodec(permMap());
    const adminRead = codec.encode({ role: 'admin', action: 'read', resource: 10 }).value;
    const editorRead = codec.encode({ role: 'editor', action: 'read', resource: 10 }).value;
    // role이 1 증가 → value가 strides[0]만큼 증가
    expect(editorRead - adminRead).toBe(codec.strides[0]);
  });
});

// ── dimIds ───────────────────────────────────────────────────────────────────
//
// shape/strides가 숫자 배열이므로 "몇 번째가 어떤 차원인지" label 확인용.

describe('dimIds', () => {
  it('dim 이름 배열을 shape 순서대로 반환한다', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.dimIds).toEqual(['role', 'action', 'resource']);
  });

  it('dimIds.length === shape.length', () => {
    const codec = new MetaCodec(singleDimMap());
    expect(codec.dimIds).toHaveLength(codec.shape.length);
  });
});

// ── enumerate ────────────────────────────────────────────────────────────────
//
// matchRanges()가 [from, to] 범위를 반환하는 반면,
// enumerate()는 개별 value로 전개한다.
// UI 그리드 셀 하이라이트, 접근 가능 주소 목록 등에 사용.

describe('enumerate', () => {
  it('role=admin인 주소 9개를 개별 값으로 전개한다', () => {
    const codec = new MetaCodec(permMap());
    const values = codec.enumerate({ role: 'admin' });
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('두 dim 고정 → 연속 3개', () => {
    const codec = new MetaCodec(permMap());
    const values = codec.enumerate({ role: 'editor', action: 'write' });
    expect(values).toEqual([12, 13, 14]);
  });

  it('전체 와일드카드 → [0 .. size-1]', () => {
    const codec = new MetaCodec(permMap());
    const values = codec.enumerate({});
    expect(values).toHaveLength(27);
    expect(values[0]).toBe(0);
    expect(values[26]).toBe(26);
  });

  it('전개된 값은 모두 해당 패턴과 매칭된다', () => {
    const codec = new MetaCodec(permMap());
    const values = codec.enumerate({ action: 'delete' });
    for (const v of values) {
      expect(codec.decodeValue(v).action).toBe('delete');
    }
  });

  it('단일 dim codec', () => {
    const codec = new MetaCodec(singleDimMap());
    expect(codec.enumerate({ level: 2 })).toEqual([2]);
    expect(codec.enumerate({})).toEqual([0, 1, 2, 3]);
  });
});

// ── resolveRef ──────────────────────────────────────────────────────────────
//
// permission index에 service index를 참조하는 perm_svc dim이 있을 때,
// permission 주소에서 service의 구성 차원을 한 번에 추출한다.
//
// 기존 API 패턴:
//   const svcIdx = Math.floor(permValue / roleStride);
//   const svcValue = PERM_SVC_VALUES[svcIdx];
//   const decoded = decodeSvcValue(svcValue);
//
// 개선:
//   permCodec.resolveRef(permValue, "perm_svc", svcCodec)

describe('resolveRef', () => {
  // 픽스처: service (2 dim) + permission (index_ref + string)
  const svcMap: DecodeMap = {
    indexId: 'service',
    versionId: 'v1',
    shape: [3, 2],
    size: 6,
    dims: [
      {
        dimId: 'env',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['dev', 'stage', 'prod'],
      },
      {
        dimId: 'region',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['us', 'asia'],
      },
    ],
  };

  // perm_svc entries는 service index의 압축 주소들
  // 0 = (dev,us), 1 = (dev,asia), 2 = (stage,us), 3 = (stage,asia), 4 = (prod,us), 5 = (prod,asia)
  const permRefMap: DecodeMap = {
    indexId: 'permission',
    versionId: 'v1',
    shape: [3, 2],
    size: 6,
    dims: [
      {
        dimId: 'perm_svc',
        snapshotId: 'pv1',
        kind: { type: 'index_ref', indexId: 'service' },
        entries: [0, 2, 4],
      },
      {
        dimId: 'role',
        snapshotId: 'rv1',
        kind: { type: 'string_enum' },
        entries: ['admin', 'editor'],
      },
    ],
  };

  it('index_ref dim의 참조를 target codec으로 해석한다', () => {
    const svcCodec = new MetaCodec(svcMap);
    const permCodec = new MetaCodec(permRefMap);

    // perm_svc=0(dev,us), role=admin → value 0
    const result = permCodec.resolveRef(0, 'perm_svc', svcCodec);
    expect(result).toEqual({ env: 'dev', region: 'us' });
  });

  it('다른 참조값도 올바르게 해석한다', () => {
    const svcCodec = new MetaCodec(svcMap);
    const permCodec = new MetaCodec(permRefMap);

    // perm_svc=4(prod,us), role=editor → value = 1*2 + 1 = 3? No.
    // shape [3, 2], entries [0, 2, 4], ["admin", "editor"]
    // encode({ perm_svc: 4, role: "editor" }) → perm_svc is at index 3 (1-based), role at 2
    // value = (3-1)*2 + (2-1) = 5
    const vv = permCodec.encode({ perm_svc: 4, role: 'editor' });
    const result = permCodec.resolveRef(vv.value, 'perm_svc', svcCodec);
    expect(result).toEqual({ env: 'prod', region: 'us' });
  });

  it('존재하지 않는 dim → ValidationError', () => {
    const permCodec = new MetaCodec(permRefMap);
    const svcCodec = new MetaCodec(svcMap);
    expect(() => permCodec.resolveRef(0, 'unknown_dim', svcCodec)).toThrow(ValidationError);
  });

  it('index_ref가 아닌 dim → ValidationError', () => {
    const permCodec = new MetaCodec(permRefMap);
    const svcCodec = new MetaCodec(svcMap);
    expect(() => permCodec.resolveRef(0, 'role', svcCodec)).toThrow(ValidationError);
  });
});

// ── decodeBatch ──────────────────────────────────────────────────────────────
//
// 구조화 로그에 저장된 주소 배열을 일괄 디코딩.
// 반복 decode보다 오버헤드가 적고, 코드가 간결해진다.

describe('decodeBatch', () => {
  it('여러 value를 한 번에 decode한다', () => {
    const codec = new MetaCodec(permMap());
    const values = [0, 13, 26];
    const results = codec.decodeBatch(values);

    expect(results).toEqual([
      { role: 'admin', action: 'read', resource: 10 },
      { role: 'editor', action: 'write', resource: 20 },
      { role: 'viewer', action: 'delete', resource: 30 },
    ]);
  });

  it('빈 배열 → 빈 배열', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.decodeBatch([])).toEqual([]);
  });

  it('각 결과가 frozen이다', () => {
    const codec = new MetaCodec(permMap());
    const results = codec.decodeBatch([0, 1]);
    for (const r of results) {
      expect(Object.isFrozen(r)).toBe(true);
    }
  });

  it('개별 decodeValue와 동일한 결과를 반환한다', () => {
    const codec = new MetaCodec(permMap());
    for (let v = 0; v < codec.size; v++) {
      const [batched] = codec.decodeBatch([v]);
      expect(batched).toEqual(codec.decodeValue(v));
    }
  });
});

// ── MetaRegistry.hasIndex / isValidVersion ──────────────────────────────────
//
// API 핸들러에서 요청 파라미터 검증 시 throw 없이 boolean 반환.

describe('MetaRegistry hasIndex / isValidVersion', () => {
  const reg = new MetaRegistry({
    dims: {
      role: { kind: { type: 'string_enum' as const }, snapshots: { v1: { entries: ['admin'] } } },
    },
    indices: {
      perm: { dims: ['role'], versions: { iv1: { snapshots: { role: 'v1' } } } },
    },
  });

  it('hasIndex: 등록된 index → true', () => {
    expect(reg.hasIndex('perm')).toBe(true);
  });

  it('hasIndex: 미등록 index → false', () => {
    expect(reg.hasIndex('unknown')).toBe(false);
  });

  it('isValidVersion: 유효한 조합 → true', () => {
    expect(reg.isValidVersion('perm', 'iv1')).toBe(true);
  });

  it('isValidVersion: 유효하지 않은 version → false', () => {
    expect(reg.isValidVersion('perm', 'iv999')).toBe(false);
  });

  it('isValidVersion: 미등록 index → false (throw 없음)', () => {
    expect(reg.isValidVersion('unknown', 'iv1')).toBe(false);
  });
});

// ── strides / dimIds 캐싱 ─────────────────────────────────────────────────────

describe('strides / dimIds 캐싱', () => {
  it('strides는 매 호출마다 동일 참조를 반환한다', () => {
    const codec = new MetaCodec(permMap());
    const a = codec.strides;
    const b = codec.strides;
    expect(a).toBe(b); // 참조 동일 (캐싱됨)
  });

  it('strides 값이 shape에 대해 정확하다', () => {
    // shape [3, 3, 3] → strides [9, 3, 1]
    const codec = new MetaCodec(permMap());
    expect(codec.strides).toEqual([9, 3, 1]);
  });

  it('dimIds는 매 호출마다 동일 참조를 반환한다', () => {
    const codec = new MetaCodec(permMap());
    const a = codec.dimIds;
    const b = codec.dimIds;
    expect(a).toBe(b); // 참조 동일 (캐싱됨)
  });

  it('dimIds 값이 dims 순서와 일치한다', () => {
    const codec = new MetaCodec(permMap());
    expect(codec.dimIds).toEqual(['role', 'action', 'resource']);
  });

  it('단일 dim에서도 strides/dimIds가 정확하다', () => {
    const codec = new MetaCodec(singleDimMap());
    expect(codec.strides).toEqual([1]);
    expect(codec.dimIds).toEqual(['level']);
  });
});
