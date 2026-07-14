// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect } from 'vitest';
import { MetaRegistry } from './meta-registry.js';
import { MetaCodec } from './meta-codec.js';
import { MetaResolver } from './meta-resolver.js';
import { IndexNotFoundError, IndexVersionNotFoundError, DimNotFoundError } from './errors.js';
import {
  WeightedIndex,
  PACK_FORMATS,
  createAddressConverter,
  createLayoutProtocol,
  type AddressConfig,
} from 'weighted-index';

// ── 공통 픽스처 ────────────────────────────────────────────────────────────────

const baseInput = () => ({
  dims: {
    role: {
      kind: { type: 'string_enum' } as const,
      description: '사용자 역할',
      snapshots: {
        v1: { entries: ['admin', 'editor', 'viewer'] },
        v2: {
          entries: ['admin', 'editor', 'viewer', 'guest'],
          entryFlags: {
            2: { status: 'inactive' as const, reason: 'deprecated', updatedAt: '2026-01-01' },
          },
        },
      },
    },
    action: {
      kind: { type: 'string_enum' } as const,
      snapshots: {
        v1: { entries: ['read', 'write', 'delete'] },
      },
    },
    resource: {
      kind: { type: 'number_enum' } as const,
      snapshots: {
        v1: { entries: [10, 20, 30] },
      },
    },
  },
  indices: {
    perm: {
      dims: ['role', 'action', 'resource'],
      description: '권한 인덱스',
      versions: {
        iv1: { snapshots: { role: 'v1', action: 'v1', resource: 'v1' } },
        iv2: { snapshots: { role: 'v2', action: 'v1', resource: 'v1' } },
      },
    },
  },
});

// ── DecodeMap ──────────────────────────────────────────────────────────────────

describe('getDecodeMap', () => {
  it('shape과 size가 정확하다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    expect(map.indexId).toBe('perm');
    expect(map.versionId).toBe('iv1');
    expect(map.shape).toEqual([3, 3, 3]);
    expect(map.size).toBe(27);
  });

  it('dims가 IndexDef.dims 순서를 유지한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    expect(map.dims.map((d) => d.dimId)).toEqual(['role', 'action', 'resource']);
  });

  it('entries가 복사본이다 (원본 불변)', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    map.dims[0].entries.push('mutated' as never);
    const sn = reg.getDimSnapshot('role', 'v1');
    expect(sn.entries).toEqual(['admin', 'editor', 'viewer']);
  });

  it('kind가 포함된다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    expect(map.dims[0].kind).toEqual({ type: 'string_enum' });
    expect(map.dims[2].kind).toEqual({ type: 'number_enum' });
  });

  it('version이 다르면 shape이 다르다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);

    expect(resolver.getDecodeMap('perm', 'iv1').shape).toEqual([3, 3, 3]);
    expect(resolver.getDecodeMap('perm', 'iv2').shape).toEqual([4, 3, 3]);
  });

  it('address 미설정 시 address가 undefined', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(resolver.getDecodeMap('perm', 'iv1').address).toBeUndefined();
  });

  it('address 설정 시 address가 포함된다', () => {
    const reg = new MetaRegistry({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    expect(map.address).toBeDefined();
    expect(map.address!.schemas).toEqual({ perm: 1 });
  });

  it('DecodeMap으로 외부에서 decode를 재현할 수 있다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');

    // encode로 값 생성
    const codec = reg.createCodec('perm', 'iv1');
    const vv = codec.encode({ role: 'editor', action: 'write', resource: 20 });

    // DecodeMap만으로 외부 decode 재현
    const coords = new WeightedIndex(map.shape).decode(vv.value);
    const result: Record<string, string | number> = {};
    for (let i = 0; i < map.dims.length; i++) {
      result[map.dims[i].dimId] = map.dims[i].entries[coords[i] - 1];
    }

    expect(result).toEqual({ role: 'editor', action: 'write', resource: 20 });
  });

  it('미등록 indexId는 IndexNotFoundError', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDecodeMap('unknown', 'iv1')).toThrow(IndexNotFoundError);
  });

  it('미등록 versionId는 IndexVersionNotFoundError', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDecodeMap('perm', 'iv99')).toThrow(IndexVersionNotFoundError);
  });
});

// ── DimRange ──────────────────────────────────────────────────────────────────

describe('getDimRange', () => {
  it('dim의 모든 snapshot을 반환한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange('role');

    expect(range.dimId).toBe('role');
    expect(range.kind).toEqual({ type: 'string_enum' });
    expect(range.description).toBe('사용자 역할');
    expect(range.snapshots).toHaveLength(2);
  });

  it('각 snapshot의 entries와 total이 정확하다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange('role');

    const v1 = range.snapshots.find((s) => s.snapshotId === 'v1')!;
    expect(v1.entries).toEqual(['admin', 'editor', 'viewer']);
    expect(v1.total).toBe(3);
    expect(v1.activeIndices).toEqual([1, 2, 3]);

    const v2 = range.snapshots.find((s) => s.snapshotId === 'v2')!;
    expect(v2.entries).toEqual(['admin', 'editor', 'viewer', 'guest']);
    expect(v2.total).toBe(4);
    expect(v2.activeIndices).toEqual([1, 3, 4]); // editor(2) inactive
  });

  it('snapshot이 하나인 dim도 정상 동작한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange('action');

    expect(range.snapshots).toHaveLength(1);
    expect(range.snapshots[0].entries).toEqual(['read', 'write', 'delete']);
  });

  it('미등록 dimId는 DimNotFoundError', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    expect(() => resolver.getDimRange('unknown')).toThrow(DimNotFoundError);
  });

  it('getDimRange에 capacity/headroom이 포함된다', () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = { entries: ['admin', 'editor', 'viewer'], capacity: 8 };
    const reg = new MetaRegistry(input);
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange('role');

    const v1 = range.snapshots.find((s) => s.snapshotId === 'v1')!;
    expect(v1.capacity).toBe(8);
    expect(v1.headroom).toBe(5); // 8 - 3
  });

  it('capacity 미설정 시 capacity = total, headroom = 0', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getDimRange('action');

    const v1 = range.snapshots.find((s) => s.snapshotId === 'v1')!;
    expect(v1.capacity).toBe(v1.total);
    expect(v1.headroom).toBe(0);
  });
});

// ── IndexRange ──────────────────────────────────────────────────────────────────

describe('getIndexRange', () => {
  it('index의 모든 version을 반환한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    expect(range.indexId).toBe('perm');
    expect(range.description).toBe('권한 인덱스');
    expect(range.dimIds).toEqual(['role', 'action', 'resource']);
    expect(range.versions).toHaveLength(2);
  });

  it('각 version의 shape이 정확하다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    const iv1 = range.versions.find((v) => v.versionId === 'iv1')!;
    const iv2 = range.versions.find((v) => v.versionId === 'iv2')!;

    expect(iv1.shape).toEqual([3, 3, 3]);
    expect(iv1.size).toBe(27);
    expect(iv2.shape).toEqual([4, 3, 3]);
    expect(iv2.size).toBe(36);
  });

  it('version별 dim의 activeIndices가 다르다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    const iv1 = range.versions.find((v) => v.versionId === 'iv1')!;
    const iv2 = range.versions.find((v) => v.versionId === 'iv2')!;

    const roleIv1 = iv1.dims.find((d) => d.dimId === 'role')!;
    const roleIv2 = iv2.dims.find((d) => d.dimId === 'role')!;

    expect(roleIv1.activeIndices).toEqual([1, 2, 3]);
    expect(roleIv2.activeIndices).toEqual([1, 3, 4]); // editor(2) inactive in v2
  });

  it('version별 dim의 snapshotId가 다르다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    const iv1 = range.versions.find((v) => v.versionId === 'iv1')!;
    const iv2 = range.versions.find((v) => v.versionId === 'iv2')!;

    expect(iv1.dims[0].snapshotId).toBe('v1'); // role → v1
    expect(iv2.dims[0].snapshotId).toBe('v2'); // role → v2
    expect(iv1.dims[1].snapshotId).toBe('v1'); // action → 동일
    expect(iv2.dims[1].snapshotId).toBe('v1');
  });

  it('getIndexRange dims에 capacity/headroom이 포함된다', () => {
    const input = baseInput();
    input.dims.role.snapshots.v1 = { entries: ['admin', 'editor', 'viewer'], capacity: 8 };
    const reg = new MetaRegistry(input);
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    const iv1 = range.versions.find((v) => v.versionId === 'iv1')!;
    const roleDim = iv1.dims.find((d) => d.dimId === 'role')!;
    expect(roleDim.capacity).toBe(8);
    expect(roleDim.headroom).toBe(5); // 8 - 3
  });

  it('capacity 미설정 시 dims의 capacity = entries.length, headroom = 0', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const range = resolver.getIndexRange('perm');

    const iv1 = range.versions.find((v) => v.versionId === 'iv1')!;
    const actionDim = iv1.dims.find((d) => d.dimId === 'action')!;
    expect(actionDim.capacity).toBe(actionDim.entries.length);
    expect(actionDim.headroom).toBe(0);
  });
});

// ── MetaDataset ──────────────────────────────────────────────────────────────

describe('getDataset', () => {
  it('전체 indices와 dims를 포함한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    expect(dataset.indices.map((i) => i.indexId)).toContain('perm');
    expect(dataset.dims.map((d) => d.dimId)).toEqual(
      expect.arrayContaining(['role', 'action', 'resource']),
    );
  });

  it('indices와 dims의 내용이 개별 조회와 동일하다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    const permFromDataset = dataset.indices.find((i) => i.indexId === 'perm')!;
    const permDirect = resolver.getIndexRange('perm');
    expect(permFromDataset).toEqual(permDirect);

    const roleFromDataset = dataset.dims.find((d) => d.dimId === 'role')!;
    const roleDirect = resolver.getDimRange('role');
    expect(roleFromDataset).toEqual(roleDirect);
  });
});

// ── 다중 인덱스 시나리오 ────────────────────────────────────────────────────

describe('다중 인덱스', () => {
  const multiInput = () => ({
    dims: {
      role: {
        kind: { type: 'string_enum' } as const,
        snapshots: { v1: { entries: ['admin', 'editor'] } },
      },
      category: {
        kind: { type: 'string_enum' } as const,
        snapshots: {
          v1: { entries: ['tech', 'art'] },
          v2: { entries: ['tech', 'art', 'science'] },
        },
      },
      lang: {
        kind: { type: 'string_enum' } as const,
        snapshots: { v1: { entries: ['ko', 'en'] } },
      },
    },
    indices: {
      perm: {
        dims: ['role'],
        versions: { v1: { snapshots: { role: 'v1' } } },
      },
      content: {
        dims: ['category', 'lang'],
        versions: {
          cv1: { snapshots: { category: 'v1', lang: 'v1' } },
          cv2: { snapshots: { category: 'v2', lang: 'v1' } },
        },
      },
    },
  });

  it('인덱스별로 독립된 range를 반환한다', () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);

    const perm = resolver.getIndexRange('perm');
    const content = resolver.getIndexRange('content');

    expect(perm.dimIds).toEqual(['role']);
    expect(perm.versions).toHaveLength(1);

    expect(content.dimIds).toEqual(['category', 'lang']);
    expect(content.versions).toHaveLength(2);
  });

  it('getDataset이 모든 인덱스를 포함한다', () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    expect(dataset.indices.map((i) => i.indexId).toSorted()).toEqual(['content', 'perm']);
    expect(dataset.dims.map((d) => d.dimId).toSorted()).toEqual(['category', 'lang', 'role']);
  });

  it('공유 dim은 dims에 한 번만 등장한다', () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const dataset = resolver.getDataset();

    const dimIds = dataset.dims.map((d) => d.dimId);
    expect(new Set(dimIds).size).toBe(dimIds.length);
  });

  it('content cv2에서 category가 확장된 것이 반영된다', () => {
    const reg = new MetaRegistry(multiInput());
    const resolver = new MetaResolver(reg);
    const content = resolver.getIndexRange('content');

    const cv1 = content.versions.find((v) => v.versionId === 'cv1')!;
    const cv2 = content.versions.find((v) => v.versionId === 'cv2')!;

    expect(cv1.shape).toEqual([2, 2]);
    expect(cv2.shape).toEqual([3, 2]);
    expect(cv2.dims[0].entries).toEqual(['tech', 'art', 'science']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  유저 시나리오 + 안정화 테스트 (갭 분석 HIGH 4건 + MEDIUM 4건)
// ══════════════════════════════════════════════════════════════════════════════

// ── [HIGH-1] 외부 UUID → DecodeMap 자립 디코딩 ─────────────────────────────────
//
// DecodeMap + address 번들만으로 MetaRegistry 없이
// UUID 파싱 → value 추출 → 좌표 복원 → entity 매핑 전체를 수행한다.

describe('시나리오: DecodeMap 자립 UUID 디코딩', () => {
  const addressInput = () => ({
    ...baseInput(),
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { iv1: 1, iv2: 2 },
    },
  });

  /** DecodeMap.address 기반으로 외부에서 UUID를 파싱하는 순수 함수 (MetaRegistry 미사용) */
  function externalParseUUID(uuid: string, address: AddressConfig) {
    const raw = uuid.replace(/-/g, '').toLowerCase();
    const sNum = parseInt(raw.slice(0, address.schemaChars), 16);
    const vNum = parseInt(
      raw.slice(address.schemaChars, address.schemaChars + address.versionChars),
      16,
    );
    const indexHex = raw.slice(address.schemaChars + address.versionChars);
    const value = parseInt(indexHex, 16);

    const schema = Object.entries(address.schemas).find(([, n]) => n === sNum)?.[0];
    const version = Object.entries(address.versions).find(([, n]) => n === vNum)?.[0];
    if (!schema || !version) throw new Error('Unknown schema/version');
    return { indexId: schema, versionId: version, value };
  }

  /** DecodeMap 기반으로 외부에서 value → entity ID를 복원하는 순수 함수 */
  function externalDecode(
    value: number,
    map: { shape: number[]; dims: { dimId: string; entries: (string | number)[] }[] },
  ) {
    const coords = new WeightedIndex(map.shape).decode(value);
    const result: Record<string, string | number> = {};
    for (let i = 0; i < map.dims.length; i++) {
      result[map.dims[i].dimId] = map.dims[i].entries[coords[i] - 1];
    }
    return result;
  }

  it('DecodeMap(address 포함) 번들만으로 UUID → entity ID 전체 복원', () => {
    const reg = new MetaRegistry(addressInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');
    const codec = reg.createCodec('perm', 'iv1');

    // 서버에서 UUID PK 생성
    const entityIds = { role: 'viewer', action: 'delete', resource: 30 };
    const uuid = reg.serialize(codec.encode(entityIds));

    // ── 여기서부터 MetaRegistry 없이 외부에서 수행 ──
    const vv = externalParseUUID(uuid, map.address!);
    expect(vv.indexId).toBe('perm');
    expect(vv.versionId).toBe('iv1');

    const decoded = externalDecode(vv.value, map);
    expect(decoded).toEqual(entityIds);
  });

  it('여러 entity 조합 → UUID → 외부 디코딩 모두 일치', () => {
    const reg = new MetaRegistry(addressInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');
    const codec = reg.createCodec('perm', 'iv1');

    const cases = [
      { role: 'admin', action: 'read', resource: 10 },
      { role: 'editor', action: 'write', resource: 20 },
      { role: 'viewer', action: 'delete', resource: 30 },
    ];

    for (const entityIds of cases) {
      const uuid = reg.serialize(codec.encode(entityIds));
      const vv = externalParseUUID(uuid, map.address!);
      const decoded = externalDecode(vv.value, map);
      expect(decoded).toEqual(entityIds);
    }
  });

  it('JSON 직렬화/역직렬화를 거쳐도 DecodeMap이 정상 동작한다', () => {
    const reg = new MetaRegistry(addressInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('perm', 'iv1');
    const codec = reg.createCodec('perm', 'iv1');

    // 네트워크 전송 시뮬레이션
    const json = JSON.stringify(map);
    const received = JSON.parse(json);

    const uuid = reg.serialize(codec.encode({ role: 'editor', action: 'write', resource: 20 }));
    const vv = externalParseUUID(uuid, received.address);
    const decoded = externalDecode(vv.value, received);
    expect(decoded).toEqual({ role: 'editor', action: 'write', resource: 20 });
  });
});

// ── [HIGH-2] RDB 다중 엔티티 저장 워크플로우 ──────────────────────────────────
//
// 여러 entity 조합을 UUID PK로 생성 → 저장 → 전부 복원하는 사이클.

describe('시나리오: RDB 다중 엔티티 저장/복원', () => {
  const rdbInput = () => ({
    ...baseInput(),
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { iv1: 1, iv2: 2 },
    },
  });

  it('5개 엔티티를 UUID PK로 저장하고 전부 정확하게 복원한다', () => {
    const reg = new MetaRegistry(rdbInput());
    const codec = reg.createCodec('perm', 'iv1');

    const entities = [
      { role: 'admin', action: 'read', resource: 10 },
      { role: 'admin', action: 'write', resource: 20 },
      { role: 'editor', action: 'delete', resource: 30 },
      { role: 'viewer', action: 'read', resource: 20 },
      { role: 'viewer', action: 'write', resource: 10 },
    ];

    // 저장 (encode → serialize → DB에 UUID 저장)
    const db: string[] = entities.map((e) => reg.serialize(codec.encode(e)));

    // 모든 PK가 유일한지 확인
    expect(new Set(db).size).toBe(entities.length);

    // 복원 (DB에서 UUID 읽기 → parse → decode)
    const restored = db.map((pk) => codec.decode(reg.parse(pk)));
    expect(restored).toEqual(entities);
  });

  it('전체 조합 space의 bijection이 UUID 수준에서도 보장된다', () => {
    const reg = new MetaRegistry(rdbInput());
    const codec = reg.createCodec('perm', 'iv1');
    const roles = ['admin', 'editor', 'viewer'];
    const actions = ['read', 'write', 'delete'];
    const resources = [10, 20, 30];

    const pks = new Set<string>();
    for (const role of roles) {
      for (const action of actions) {
        for (const resource of resources) {
          const pk = reg.serialize(codec.encode({ role, action, resource }));
          expect(pks.has(pk)).toBe(false);
          pks.add(pk);

          // round-trip
          expect(codec.decode(reg.parse(pk))).toEqual({ role, action, resource });
        }
      }
    }
    expect(pks.size).toBe(27); // 3×3×3
  });
});

// ── [HIGH-3] 버전 마이그레이션 PK 워크플로우 ──────────────────────────────────
//
// v1 UUID PK → parse → decode → 동일 entity ID로 v2 re-encode → 새 UUID PK.

describe('시나리오: 버전 마이그레이션 (UUID PK 수준)', () => {
  const migrationInput = () => ({
    ...baseInput(),
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { iv1: 1, iv2: 2 },
    },
  });

  it('v1 UUID PK를 v2로 마이그레이션하면 entity ID가 보존된다', () => {
    const reg = new MetaRegistry(migrationInput());
    const iv1 = reg.createCodec('perm', 'iv1');
    const iv2 = reg.createCodec('perm', 'iv2');

    const entityIds = { role: 'admin', action: 'write', resource: 20 };

    // v1으로 저장
    const v1PK = reg.serialize(iv1.encode(entityIds));

    // v1 PK → decode
    const vv1 = reg.parse(v1PK);
    expect(vv1.versionId).toBe('iv1');
    const decoded = iv1.decode(vv1);
    expect(decoded).toEqual(entityIds);

    // 동일 entity로 v2 re-encode
    const v2PK = reg.serialize(iv2.encode(decoded));

    // v2 PK → decode → 동일 entity 확인
    expect(iv2.decode(reg.parse(v2PK))).toEqual(entityIds);

    // v1과 v2의 UUID는 다르다 (version 필드가 다름)
    expect(v1PK).not.toBe(v2PK);
    const raw1 = v1PK.replace(/-/g, '');
    const raw2 = v2PK.replace(/-/g, '');
    expect(raw1.slice(4, 6)).toBe('01'); // iv1 → 1
    expect(raw2.slice(4, 6)).toBe('02'); // iv2 → 2
  });

  it('v2에만 있는 entity(guest)로 마이그레이션 가능', () => {
    const reg = new MetaRegistry(migrationInput());
    const iv1 = reg.createCodec('perm', 'iv1');
    const iv2 = reg.createCodec('perm', 'iv2');

    // v2에만 있는 guest를 포함한 entity
    const v2Entity = { role: 'guest', action: 'read', resource: 10 };
    const pk = reg.serialize(iv2.encode(v2Entity));
    expect(iv2.decode(reg.parse(pk))).toEqual(v2Entity);

    // 같은 entity로 v1 encode는 실패 (guest가 v1에 없음)
    expect(() => iv1.encode(v2Entity)).toThrow();
  });

  it('batch 마이그레이션: v1 PK 배열 → v2 PK 배열', () => {
    const reg = new MetaRegistry(migrationInput());
    const iv1 = reg.createCodec('perm', 'iv1');
    const iv2 = reg.createCodec('perm', 'iv2');

    const v1Entities = [
      { role: 'admin', action: 'read', resource: 10 },
      { role: 'editor', action: 'write', resource: 20 },
      { role: 'viewer', action: 'delete', resource: 30 },
    ];

    const v1PKs = v1Entities.map((e) => reg.serialize(iv1.encode(e)));

    // batch migration
    const v2PKs = v1PKs.map((pk) => {
      const decoded = iv1.decode(reg.parse(pk));
      return reg.serialize(iv2.encode(decoded));
    });

    // 전부 복원 가능하고 entity 동일
    for (let i = 0; i < v1Entities.length; i++) {
      expect(iv2.decode(reg.parse(v2PKs[i]))).toEqual(v1Entities[i]);
      expect(v2PKs[i]).not.toBe(v1PKs[i]); // version 필드가 다르므로 UUID도 다름
    }
  });
});

// ── [HIGH-4] DecodeMap에 index_ref dim 포함 ────────────────────────────────────
//
// 중첩 인덱스의 DecodeMap이 kind: index_ref 정보를 포함해
// 외부에서 재귀 decode 판단을 할 수 있는지 검증.

describe('시나리오: DecodeMap + index_ref (중첩 인덱스)', () => {
  const nestedInput = () => ({
    dims: {
      format: {
        kind: { type: 'string_enum' } as const,
        snapshots: { fv1: { entries: ['pdf', 'html'] } },
      },
      lang: {
        kind: { type: 'string_enum' } as const,
        snapshots: { lv1: { entries: ['ko', 'en'] } },
      },
      quality_tier: {
        kind: { type: 'index_ref', indexId: 'doc_meta' } as const,
        snapshots: { qtv1: { entries: [0, 2] } },
      },
    },
    indices: {
      doc_meta: {
        dims: ['format', 'lang'],
        versions: { dmv1: { snapshots: { format: 'fv1', lang: 'lv1' } } },
      },
      article: {
        dims: ['quality_tier'],
        versions: { av1: { snapshots: { quality_tier: 'qtv1' } } },
      },
    },
  });

  it('index_ref dim의 kind가 DecodeMap에 올바르게 포함된다', () => {
    const reg = new MetaRegistry(nestedInput());
    const resolver = new MetaResolver(reg);
    const map = resolver.getDecodeMap('article', 'av1');

    expect(map.dims).toHaveLength(1);
    expect(map.dims[0].kind).toEqual({ type: 'index_ref', indexId: 'doc_meta' });
    expect(map.dims[0].entries).toEqual([0, 2]);
  });

  it("외부에서 kind.type === 'index_ref'를 보고 재귀 decode할 수 있다", () => {
    const reg = new MetaRegistry(nestedInput());
    const resolver = new MetaResolver(reg);

    // outer DecodeMap
    const articleMap = resolver.getDecodeMap('article', 'av1');
    // inner DecodeMap
    const docMetaMap = resolver.getDecodeMap('doc_meta', 'dmv1');

    // outer encode
    const articleCodec = reg.createCodec('article', 'av1');
    const vv = articleCodec.encode({ quality_tier: 2 });

    // 외부 decode: outer
    const outerCoords = new WeightedIndex(articleMap.shape).decode(vv.value);
    const outerResult: Record<string, number> = {};
    for (let i = 0; i < articleMap.dims.length; i++) {
      outerResult[articleMap.dims[i].dimId] = articleMap.dims[i].entries[
        outerCoords[i] - 1
      ] as number;
    }
    expect(outerResult.quality_tier).toBe(2);

    // kind.type === "index_ref" → 재귀 decode
    const dim = articleMap.dims[0];
    expect(dim.kind.type).toBe('index_ref');

    // inner decode (doc_meta value=2)
    const innerCoords = new WeightedIndex(docMetaMap.shape).decode(outerResult.quality_tier);
    const innerResult: Record<string, string | number> = {};
    for (let i = 0; i < docMetaMap.dims.length; i++) {
      innerResult[docMetaMap.dims[i].dimId] = docMetaMap.dims[i].entries[innerCoords[i] - 1];
    }

    expect(innerResult).toEqual({ format: 'html', lang: 'ko' });
  });
});

// ── [MEDIUM-5] DecodeMap address 독립성 ───────────────────────────────────────

describe('DecodeMap address 독립성', () => {
  it('반환된 DecodeMap.address를 변조해도 다음 호출에 영향 없다', () => {
    const reg = new MetaRegistry({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });
    const resolver = new MetaResolver(reg);

    const map1 = resolver.getDecodeMap('perm', 'iv1');
    // 변조
    map1.address!.schemas.perm = 999;
    (map1.address!.versions as Record<string, number>).iv1 = 888;

    const map2 = resolver.getDecodeMap('perm', 'iv1');
    expect(map2.address!.schemas.perm).toBe(1); // 원본 유지
    expect(map2.address!.versions.iv1).toBe(1);
  });
});

// ── [MEDIUM-6] parse 5개 프로토콜 자동 감지 ──────────────────────────────────

describe('parse: 5개 프로토콜 자동 감지', () => {
  const allProtoInput = () => ({
    ...baseInput(),
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { iv1: 1, iv2: 2 },
    },
  });

  it('5개 프로토콜 모두 protocol 인자 없이 자동 감지된다', () => {
    const reg = new MetaRegistry(allProtoInput());
    const codec = reg.createCodec('perm', 'iv1');
    const vv = codec.encode({ role: 'admin', action: 'read', resource: 10 });

    // 각 프로토콜로 직렬화
    const colon = reg.serialize(vv, 'colon');
    const uri = reg.serialize(vv, 'uri');
    const compact = reg.serialize(vv, 'compact');
    const uuid = reg.serialize(vv, 'layout:uuid');

    // 모두 protocol 없이 parse → 동일한 VersionedValue
    expect(reg.parse(colon)).toEqual(vv);
    expect(reg.parse(uri)).toEqual(vv);
    expect(reg.parse(compact)).toEqual(vv);
    expect(reg.parse(uuid)).toEqual(vv);
  });

  it('int64 layout도 자동 감지된다', () => {
    const reg = new MetaRegistry({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.int64,
        schemaChars: 2,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });
    // UUID layout도 추가 등록해서 두 layout 공존
    const codec = reg.createCodec('perm', 'iv1');
    const vv = codec.encode({ role: 'admin', action: 'read', resource: 10 });
    const int64 = reg.serialize(vv, 'layout:int64');

    expect(reg.parse(int64)).toEqual(vv);
  });
});

// ── [MEDIUM-7] 전체 프로토콜 encode → serialize → parse → decode round-trip ──

describe('codec + serialize/parse: 전체 프로토콜 round-trip', () => {
  it('4개 프로토콜 각각에 대해 encode → serialize → parse → decode round-trip', () => {
    const reg = new MetaRegistry({
      ...baseInput(),
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    });
    const codec = reg.createCodec('perm', 'iv1');

    const entityIds = { role: 'editor', action: 'write', resource: 20 };

    for (const proto of ['colon', 'uri', 'compact', 'layout:uuid'] as const) {
      const pk = reg.serialize(codec.encode(entityIds), proto);
      const restored = codec.decode(reg.parse(pk));
      expect(restored).toEqual(entityIds);
    }
  });
});

// ── [MEDIUM-8] 다중 인덱스 PK 혼용 ──────────────────────────────────────────

describe('시나리오: 다중 인덱스 PK 혼용', () => {
  const multiPKInput = () => ({
    dims: {
      role: {
        kind: { type: 'string_enum' } as const,
        snapshots: { v1: { entries: ['admin', 'editor'] } },
      },
      category: {
        kind: { type: 'string_enum' } as const,
        snapshots: { v1: { entries: ['tech', 'art'] } },
      },
      lang: {
        kind: { type: 'string_enum' } as const,
        snapshots: { v1: { entries: ['ko', 'en'] } },
      },
    },
    indices: {
      perm: {
        dims: ['role'],
        versions: { v1: { snapshots: { role: 'v1' } } },
      },
      content: {
        dims: ['category', 'lang'],
        versions: { v1: { snapshots: { category: 'v1', lang: 'v1' } } },
      },
    },
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1, content: 2 },
      versions: { v1: 1 },
    },
  });

  it('서로 다른 index의 PK가 parse 시 올바른 index로 라우팅된다', () => {
    const reg = new MetaRegistry(multiPKInput());
    const permCodec = reg.createCodec('perm', 'v1');
    const contentCodec = reg.createCodec('content', 'v1');

    const permPK = reg.serialize(permCodec.encode({ role: 'admin' }));
    const contentPK = reg.serialize(contentCodec.encode({ category: 'tech', lang: 'ko' }));

    // parse가 올바른 indexId를 반환하는지
    const permVV = reg.parse(permPK);
    const contentVV = reg.parse(contentPK);

    expect(permVV.indexId).toBe('perm');
    expect(contentVV.indexId).toBe('content');

    // decode로 entity 복원 시 올바른 dim set
    expect(permCodec.decode(permVV)).toEqual({ role: 'admin' });
    expect(contentCodec.decode(contentVV)).toEqual({ category: 'tech', lang: 'ko' });
  });

  it('index간 PK가 절대 충돌하지 않는다', () => {
    const reg = new MetaRegistry(multiPKInput());
    const permCodec = reg.createCodec('perm', 'v1');
    const contentCodec = reg.createCodec('content', 'v1');

    const permPKs = ['admin', 'editor'].map((role) => reg.serialize(permCodec.encode({ role })));

    const contentPKs: string[] = [];
    for (const category of ['tech', 'art']) {
      for (const lang of ['ko', 'en']) {
        contentPKs.push(reg.serialize(contentCodec.encode({ category, lang })));
      }
    }

    const allPKs = [...permPKs, ...contentPKs];
    expect(new Set(allPKs).size).toBe(allPKs.length);
  });

  it('DecodeMap도 index별로 독립된 데이터를 반환한다', () => {
    const reg = new MetaRegistry(multiPKInput());
    const resolver = new MetaResolver(reg);

    const permMap = resolver.getDecodeMap('perm', 'v1');
    const contentMap = resolver.getDecodeMap('content', 'v1');

    expect(permMap.dims.map((d) => d.dimId)).toEqual(['role']);
    expect(contentMap.dims.map((d) => d.dimId)).toEqual(['category', 'lang']);
    expect(permMap.shape).toEqual([2]);
    expect(contentMap.shape).toEqual([2, 2]);
  });
});

// ── getDecodeMap ↔ createCodec().toDecodeMap() 일관성 ────────────────────────

describe('getDecodeMap은 createCodec().toDecodeMap()와 동일한 코어 데이터를 반환한다', () => {
  it('address 미설정: 코어 필드가 동일하다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);

    const fromResolver = resolver.getDecodeMap('perm', 'iv1');
    const fromCodec = reg.createCodec('perm', 'iv1').toDecodeMap();

    // 코어 필드 일치
    expect(fromResolver.indexId).toBe(fromCodec.indexId);
    expect(fromResolver.versionId).toBe(fromCodec.versionId);
    expect(fromResolver.shape).toEqual(fromCodec.shape);
    expect(fromResolver.size).toBe(fromCodec.size);
    expect(fromResolver.dims).toEqual(fromCodec.dims);

    // address 미설정 시 address 필드 없음
    expect(fromResolver.address).toBeUndefined();
    expect(fromCodec.address).toBeUndefined();
  });

  it('address 설정: 코어 필드 동일 + address 추가', () => {
    const input = {
      ...baseInput(),
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1, iv2: 2 },
      },
    };
    const reg = new MetaRegistry(input);
    const resolver = new MetaResolver(reg);

    const fromResolver = resolver.getDecodeMap('perm', 'iv1');
    const fromCodec = reg.createCodec('perm', 'iv1').toDecodeMap();

    // 코어 필드 일치
    expect(fromResolver.indexId).toBe(fromCodec.indexId);
    expect(fromResolver.versionId).toBe(fromCodec.versionId);
    expect(fromResolver.shape).toEqual(fromCodec.shape);
    expect(fromResolver.size).toBe(fromCodec.size);
    expect(fromResolver.dims).toEqual(fromCodec.dims);

    // resolver만 address를 추가
    expect(fromResolver.address).toBeDefined();
    expect(fromResolver.address!.schemas).toEqual({ perm: 1 });
  });

  it('두 경로로 만든 MetaCodec이 동일하게 동작한다', () => {
    const reg = new MetaRegistry(baseInput());
    const resolver = new MetaResolver(reg);

    const codecDirect = reg.createCodec('perm', 'iv1');
    const codecFromMap = new MetaCodec(resolver.getDecodeMap('perm', 'iv1'));

    const entityIds = { role: 'admin', action: 'write', resource: 20 };
    const vv1 = codecDirect.encode(entityIds);
    const vv2 = codecFromMap.encode(entityIds);
    expect(vv1).toEqual(vv2);

    expect(codecDirect.decode(vv1)).toEqual(codecFromMap.decode(vv2));
  });
});
