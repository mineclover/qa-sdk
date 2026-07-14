// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LabelRegistry, createLabelRegistry } from './label-registry.js';
import {
  WeightedIndexError,
  ShapeError,
  LabelNotFoundError,
  VersionNotFoundError,
  EntityNotFoundError,
} from '../math/errors.js';

// ── 픽스처 ────────────────────────────────────────────────────────────────────
//   role   : DB 정수 PK
//   action : string slug
//   api    : REST endpoint
//   tenant : 정수 PK
//   index는 ids 배열 위치(pos + 1)에서 자동 할당
const labels = new LabelRegistry({
  role: [
    { version: 'v1', ids: [1, 2, 3] },
    { version: 'v2', ids: [1, 2, 3, 4], changelog: 'superadmin(id=4) 추가' },
  ],
  action: [{ version: 'v1', ids: ['read', 'write', 'delete', 'admin'] }],
  api: [
    {
      version: 'v1',
      ids: ['/users', '/posts', '/comments', '/files', '/tags', '/likes', '/auth', '/search'],
    },
    {
      version: 'v2',
      ids: [
        '/users',
        '/posts',
        '/comments',
        '/files',
        '/tags',
        '/likes',
        '/auth',
        '/search',
        '/upload',
        '/download',
        '/export',
        '/import',
      ],
      changelog: '엔드포인트 4개 추가',
    },
  ],
  tenant: [{ version: 'v1', ids: [100, 200] }],
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] max 자동 도출
// ─────────────────────────────────────────────────────────────────────────────
describe('[단위] max 자동 도출 (ids.length)', () => {
  it('버전별 max = ids.length', () => {
    expect(labels.getMax('role', 'v1')).toBe(3);
    expect(labels.getMax('role', 'v2')).toBe(4);
    expect(labels.getMax('api', 'v1')).toBe(8);
    expect(labels.getMax('api', 'v2')).toBe(12);
    expect(labels.getMax('tenant', 'v1')).toBe(2);
  });

  it('getLatestMax: 마지막 버전의 max', () => {
    expect(labels.getLatestMax('role')).toBe(4);
    expect(labels.getLatestMax('action')).toBe(4);
    expect(labels.getLatestMax('api')).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] index 자동 할당 — ID ↔ index 왕복
// ─────────────────────────────────────────────────────────────────────────────
describe('[단위] index 자동 할당 (배열 위치 = index - 1)', () => {
  it('getIndex: entity ID → 1-based index', () => {
    expect(labels.getIndex('role', 'v1', 1)).toBe(1);
    expect(labels.getIndex('role', 'v1', 3)).toBe(3);
    expect(labels.getIndex('role', 'v2', 4)).toBe(4); // superadmin 끝에 추가 → index=4
    expect(labels.getIndex('action', 'v1', 'read')).toBe(1);
    expect(labels.getIndex('action', 'v1', 'delete')).toBe(3);
    expect(labels.getIndex('tenant', 'v1', 100)).toBe(1);
    expect(labels.getIndex('tenant', 'v1', 200)).toBe(2);
  });

  it('getEntityId: 1-based index → entity ID', () => {
    expect(labels.getEntityId('role', 'v1', 3)).toBe(3);
    expect(labels.getEntityId('role', 'v2', 4)).toBe(4);
    expect(labels.getEntityId('action', 'v1', 2)).toBe('write');
    expect(labels.getEntityId('api', 'v2', 9)).toBe('/upload');
    expect(labels.getEntityId('tenant', 'v1', 1)).toBe(100);
  });

  it('getIndex ∘ getEntityId = identity (role v2 전 범위)', () => {
    for (let idx = 1; idx <= 4; idx++) {
      const id = labels.getEntityId('role', 'v2', idx);
      expect(labels.getIndex('role', 'v2', id)).toBe(idx);
    }
  });

  it('getEntityId ∘ getIndex = identity (api v2 샘플)', () => {
    for (const ep of ['/users', '/upload', '/import']) {
      const idx = labels.getIndex('api', 'v2', ep);
      expect(labels.getEntityId('api', 'v2', idx)).toBe(ep);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] 버전 독립성
// ─────────────────────────────────────────────────────────────────────────────
describe('[단위] 버전 독립성', () => {
  it('v2에 추가된 ID는 v1으로 조회 불가', () => {
    expect(() => labels.getIndex('role', 'v1', 4)).toThrow('not found');
    expect(() => labels.getIndex('api', 'v1', '/upload')).toThrow('not found');
  });

  it('레이블마다 버전이 독립적으로 진행됨', () => {
    expect(labels.getLatestVersion('role')).toBe('v2');
    expect(labels.getLatestVersion('action')).toBe('v1');
    expect(labels.getLatestVersion('api')).toBe('v2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [팩토리] createLabelRegistry — 타입 추론 + 런타임 동작
// ─────────────────────────────────────────────────────────────────────────────
describe('[팩토리] createLabelRegistry', () => {
  it('팩토리로 생성한 인스턴스는 LabelRegistry 와 동일하게 동작', () => {
    const reg = createLabelRegistry({
      role: [{ version: 'v1', ids: [10, 20, 30] }],
      action: [{ version: 'v1', ids: ['read', 'write'] }],
    });
    expect(reg.getMax('role', 'v1')).toBe(3);
    expect(reg.getIndex('role', 'v1', 10)).toBe(1);
    expect(reg.getEntityId('action', 'v1', 2)).toBe('write');
  });

  it('팩토리는 LabelRegistry 인스턴스를 반환', () => {
    const reg = createLabelRegistry({
      x: [{ version: 'v1', ids: [1] }],
    });
    expect(reg).toBeInstanceOf(LabelRegistry);
  });

  it('다양한 EntityId 타입 혼합 지원', () => {
    const reg = createLabelRegistry({
      num: [{ version: 'v1', ids: [1, 2, 3] }],
      str: [{ version: 'v1', ids: ['a', 'b', 'c'] }],
      zero: [{ version: 'v1', ids: [0] }],
    });
    expect(reg.getIndex('num', 'v1', 1)).toBe(1);
    expect(reg.getIndex('str', 'v1', 'b')).toBe(2);
    expect(reg.getIndex('zero', 'v1', 0)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [계약] API 완전성
// ─────────────────────────────────────────────────────────────────────────────
describe('[계약] API 완전성', () => {
  it('getVersions: 등록 순서대로 반환', () => {
    const versions = labels.getVersions('role');
    expect(versions.map((v) => v.version)).toEqual(['v1', 'v2']);
    expect(versions[0].ids).toEqual([1, 2, 3]);
    expect(versions[1].ids).toEqual([1, 2, 3, 4]);
  });

  it('getVersions: 단일 버전 레이블', () => {
    const versions = labels.getVersions('tenant');
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('v1');
  });

  it('hasLabel / hasVersion: 존재 여부', () => {
    expect(labels.hasLabel('role')).toBe(true);
    expect(labels.hasLabel('nonexistent')).toBe(false);
    expect(labels.hasVersion('role', 'v1')).toBe(true);
    expect(labels.hasVersion('role', 'v99')).toBe(false);
    expect(labels.hasVersion('nonexistent', 'v1')).toBe(false);
  });

  it('labelNames: 등록된 모든 레이블 이름 반환', () => {
    expect(labels.labelNames).toEqual(['role', 'action', 'api', 'tenant']);
  });

  it('getLatestVersion: 마지막으로 등록된 버전 반환', () => {
    expect(labels.getLatestVersion('role')).toBe('v2');
    expect(labels.getLatestVersion('tenant')).toBe('v1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [경계값] 특수 입력 — -0, 빈 문자열, 특수문자
// ─────────────────────────────────────────────────────────────────────────────
describe('[경계값] 특수 입력', () => {
  it('string entity ID: 특수문자 포함 정상 처리', () => {
    const reg = new LabelRegistry({
      tag: [{ version: 'v1', ids: ['a:b', 'x/y', 'hello world', ''] }],
    });
    expect(reg.getIndex('tag', 'v1', 'a:b')).toBe(1);
    expect(reg.getIndex('tag', 'v1', '')).toBe(4);
    expect(reg.getEntityId('tag', 'v1', 3)).toBe('hello world');
  });

  it('-0 과 0 은 동일 ID로 취급 → 중복 거부', () => {
    expect(() => new LabelRegistry({ x: [{ version: 'v1', ids: [-0, 0] }] })).toThrow(
      'Duplicate entity id "0"',
    );
  });

  it('-0 단독 등록 → 0 으로 정규화되어 getIndex(0) 로 조회', () => {
    const reg = new LabelRegistry({ x: [{ version: 'v1', ids: [-0] }] });
    expect(reg.getIndex('x', 'v1', 0)).toBe(1);
    expect(reg.getEntityId('x', 'v1', 1)).toBe(0);
  });

  it("숫자 1 과 문자열 '1' 은 별개 ID", () => {
    expect(labels.getIndex('role', 'v1', 1)).toBe(1);
    expect(() => labels.getIndex('role', 'v1', '1' as unknown as number)).toThrow('not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [동치 분할] 생성자 입력 유효성
// ─────────────────────────────────────────────────────────────────────────────
describe('[동치 분할] 생성자 입력 유효성', () => {
  it('빈 ids 배열 거부', () => {
    expect(() => new LabelRegistry({ role: [{ version: 'v1', ids: [] }] })).toThrow(
      'at least one element',
    );
  });

  it('중복 entity ID 거부', () => {
    expect(() => new LabelRegistry({ role: [{ version: 'v1', ids: [1, 2, 1] }] })).toThrow(
      'Duplicate entity id "1"',
    );
  });

  it('버전에 ":" 포함 거부', () => {
    expect(() => new LabelRegistry({ role: [{ version: 'v1:bad', ids: [1] }] })).toThrow(
      'cannot contain ":"',
    );
  });

  it('중복 버전 거부', () => {
    expect(
      () =>
        new LabelRegistry({
          role: [
            { version: 'v1', ids: [1] },
            { version: 'v1', ids: [2] },
          ],
        }),
    ).toThrow('Duplicate version "v1"');
  });

  it('빈 버전 식별자 거부', () => {
    expect(() => new LabelRegistry({ role: [{ version: '', ids: [1] }] })).toThrow(
      'must be non-empty',
    );
  });

  it('알 수 없는 레이블 거부', () => {
    expect(() => labels.getMax('unknown', 'v1')).toThrow('Unknown label');
  });

  it('알 수 없는 버전 거부', () => {
    expect(() => labels.getMax('role', 'v99')).toThrow('Unknown version');
  });

  it('getEntityId: index=0 거부 (1-based)', () => {
    expect(() => labels.getEntityId('role', 'v1', 0)).toThrow('not found');
  });

  it('getEntityId: index > max 거부', () => {
    expect(() => labels.getEntityId('role', 'v1', 4)).toThrow('not found');
    expect(() => labels.getEntityId('role', 'v2', 5)).toThrow('not found');
  });

  it('getIndex: 등록되지 않은 entity ID 거부', () => {
    expect(() => labels.getIndex('role', 'v1', 999)).toThrow('not found');
    expect(() => labels.getIndex('action', 'v1', 'unknown_action')).toThrow('not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [에러 계층] instanceof 타입 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('[에러 계층] instanceof 타입 검증', () => {
  it('빈 ids → ShapeError extends WeightedIndexError', () => {
    try {
      const _lr = new LabelRegistry({ x: [{ version: 'v1', ids: [] }] });
    } catch (e) {
      expect(e).toBeInstanceOf(ShapeError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('ShapeError');
    }
  });

  it('알 수 없는 레이블 → LabelNotFoundError extends WeightedIndexError', () => {
    try {
      labels.getMax('no_such_label', 'v1');
    } catch (e) {
      expect(e).toBeInstanceOf(LabelNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('LabelNotFoundError');
    }
  });

  it('알 수 없는 버전 → VersionNotFoundError extends WeightedIndexError', () => {
    try {
      labels.getMax('role', 'v99');
    } catch (e) {
      expect(e).toBeInstanceOf(VersionNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('VersionNotFoundError');
    }
  });

  it('등록되지 않은 entity ID → EntityNotFoundError extends WeightedIndexError', () => {
    try {
      labels.getIndex('role', 'v1', 9999);
    } catch (e) {
      expect(e).toBeInstanceOf(EntityNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe('EntityNotFoundError');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [방어적 복사] 입력 배열 변이 방어
// ─────────────────────────────────────────────────────────────────────────────
describe('[방어적 복사] 입력 배열 변이 방어', () => {
  it('생성 후 원본 ids 배열 변이가 레지스트리에 영향을 주지 않는다', () => {
    const ids = [10, 20, 30];
    const entry = { version: 'v1', ids };
    const reg = new LabelRegistry({ dim: [entry] });

    // Mutate the original array after construction
    ids.push(40);
    ids[0] = 999;

    // Registry should still reflect the original values
    expect(reg.getMax('dim', 'v1')).toBe(3);
    expect(reg.getIndex('dim', 'v1', 10)).toBe(1);
    expect(reg.getIndex('dim', 'v1', 20)).toBe(2);
    expect(reg.getIndex('dim', 'v1', 30)).toBe(3);
    expect(reg.getEntityId('dim', 'v1', 1)).toBe(10);
    // 40 was added after construction, should not be found
    expect(() => reg.getIndex('dim', 'v1', 40)).toThrow('not found');
    // 999 was set after construction, should not be found
    expect(() => reg.getIndex('dim', 'v1', 999)).toThrow('not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [속성 기반] 랜덤 ID 왕복 (fast-check)
// ─────────────────────────────────────────────────────────────────────────────
describe('[속성 기반] 랜덤 ID 왕복', () => {
  it('getIndex ∘ getEntityId = identity — 임의 정수 ID 목록', () => {
    fc.assert(
      fc.property(
        // 1~20개의 고유 정수 ID 목록
        fc.uniqueArray(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 20 }),
        (ids) => {
          const reg = new LabelRegistry({ dim: [{ version: 'v1', ids }] });
          for (let idx = 1; idx <= ids.length; idx++) {
            const id = reg.getEntityId('dim', 'v1', idx);
            expect(reg.getIndex('dim', 'v1', id)).toBe(idx);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getEntityId ∘ getIndex = identity — 임의 문자열 ID 목록', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('\x00')),
          { minLength: 1, maxLength: 20 },
        ),
        (ids) => {
          const reg = new LabelRegistry({ tag: [{ version: 'v1', ids }] });
          for (const id of ids) {
            const idx = reg.getIndex('tag', 'v1', id);
            expect(reg.getEntityId('tag', 'v1', idx)).toBe(id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('max = ids.length — 임의 배열 크기', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 50 }),
        (ids) => {
          const reg = new LabelRegistry({ x: [{ version: 'v1', ids }] });
          expect(reg.getMax('x', 'v1')).toBe(ids.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
