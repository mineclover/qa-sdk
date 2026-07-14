// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { describe, it, expect } from 'vitest';
import {
  createIndexSDK,
  RESERVED_TOKENS,
  MetaCodec,
  DimNotFoundError,
  EntryNotFoundError,
  ValidationError,
} from 'index-meta';
import { AXIS } from 'demo-snapshot';

// ── 픽스처 ──────────────────────────────────────────────────────────────────

const trackingSchema = () =>
  createIndexSDK({
    dims: {
      action: {
        kind: { type: 'string_enum' as const },
        snapshots: {
          v1: { entries: [...AXIS.trackAction.entries] },
        },
      },
      page: {
        kind: { type: 'string_enum' as const },
        snapshots: {
          v1: { entries: [...AXIS.page.entries] },
        },
      },
      userType: {
        kind: { type: 'string_enum' as const },
        snapshots: {
          v1: { entries: [...AXIS.userType.entries] },
        },
      },
    },
    indices: {
      tracking: {
        dims: ['action', 'page', 'userType'],
        versions: {
          v1: { snapshots: { action: 'v1', page: 'v1', userType: 'v1' } },
        },
      },
    },
  });

// ── SDK 생성 ─────────────────────────────────────────────────────────────────

describe('createIndexSDK', () => {
  it('SDK 인스턴스를 생성한다', () => {
    const sdk = trackingSchema();
    expect(sdk.registry).toBeDefined();
  });

  it('잘못된 스키마는 에러를 던진다', () => {
    expect(() =>
      createIndexSDK({
        dims: {},
        indices: {
          broken: { dims: ['missing'], versions: { v1: { snapshots: { missing: 'v1' } } } },
        },
      }),
    ).toThrow();
  });
});

// ── client ────────────────────────────────────────────────────────────────────

describe('client', () => {
  it('encode → decode round-trip', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const input = { action: 'click', page: 'home', userType: 'member' };

    const vv = tracking.encode(input);

    expect(vv.indexId).toBe('tracking');
    expect(vv.versionId).toBe('v1');
    expect(typeof vv.value).toBe('number');
    expect(tracking.decode(vv)).toEqual(input);
  });

  it('decodeValue로 indexId/versionId 없이 decode', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const vv = tracking.encode({ action: 'scroll', page: 'cart', userType: 'premium' });

    expect(tracking.decodeValue(vv.value)).toEqual({
      action: 'scroll',
      page: 'cart',
      userType: 'premium',
    });
  });

  it('shape과 size가 정확하다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    expect(tracking.shape).toEqual([4, 4, 3]);
    expect(tracking.size).toBe(48); // 4 × 4 × 3
  });

  it('동일 client는 캐싱된다', () => {
    const sdk = trackingSchema();
    expect(sdk.client('tracking', 'v1')).toBe(sdk.client('tracking', 'v1'));
  });

  it('전체 value 범위가 bijection이다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const seen = new Set<number>();

    for (let v = 0; v < tracking.size; v++) {
      const ids = tracking.decodeValue(v);
      const re = tracking.encode(ids);
      expect(re.value).toBe(v);
      seen.add(v);
    }
    expect(seen.size).toBe(tracking.size);
  });
});

// ── entries / constants ──────────────────────────────────────────────────────

describe('entries / constants', () => {
  it('client.entries()는 바인딩된 version의 dim entries를 반환한다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    expect(tracking.entries('action')).toEqual(['click', 'view', 'scroll', 'submit']);
    expect(tracking.entries('page')).toEqual(['home', 'product', 'cart', 'checkout']);
    expect(tracking.entries('userType')).toEqual(['guest', 'member', 'premium']);
  });

  it('client.entries()는 frozen 배열을 반환한다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    expect(Object.isFrozen(tracking.entries('action'))).toBe(true);
  });

  it('client.entries()에 없는 dimId는 DimNotFoundError', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    expect(() => tracking.entries('unknown')).toThrow(DimNotFoundError);
  });

  it('client.constants()는 enum-like 객체를 반환한다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const ACTION = tracking.constants('action');

    expect(ACTION).toEqual({
      click: 'click',
      view: 'view',
      scroll: 'scroll',
      submit: 'submit',
    });
    expect(Object.isFrozen(ACTION)).toBe(true);
  });

  it('constants()를 encode에 사용할 수 있다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const ACTION = tracking.constants('action');
    const PAGE = tracking.constants('page');

    const vv = tracking.encode({ action: ACTION.click, page: PAGE.home, userType: 'guest' });
    expect(tracking.decode(vv)).toEqual({ action: 'click', page: 'home', userType: 'guest' });
  });

  it('sdk.constants()는 dimId + snapshotId로 직접 접근한다', () => {
    const sdk = trackingSchema();
    const ACTION = sdk.constants('action', 'v1');

    expect(ACTION.click).toBe('click');
    expect(ACTION.submit).toBe('submit');
  });

  it('number_enum의 constants는 string key → number value', () => {
    const sdk = createIndexSDK({
      dims: {
        level: {
          kind: { type: 'number_enum' as const },
          snapshots: { v1: { entries: [0, 10, 20, 30] } },
        },
      },
      indices: {
        tier: { dims: ['level'], versions: { v1: { snapshots: { level: 'v1' } } } },
      },
    });
    const LEVEL = sdk.client('tier', 'v1').constants('level');

    expect(LEVEL['0']).toBe(0);
    expect(LEVEL['10']).toBe(10);
    expect(LEVEL['30']).toBe(30);
  });

  it('client.constants()는 캐싱된다 (동일 참조 반환)', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    expect(tracking.constants('action')).toBe(tracking.constants('action'));
  });

  it('sdk.constants()도 캐싱된다 (동일 참조 반환)', () => {
    const sdk = trackingSchema();
    expect(sdk.constants('action', 'v1')).toBe(sdk.constants('action', 'v1'));
  });
});

// ── constants: 예약 토큰 제외 ────────────────────────────────────────────────

describe('constants: 예약 토큰 제외', () => {
  it('예약 토큰(_)은 constants에서 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        priority: {
          kind: { type: 'string_enum' as const },
          description: 'reserved: [1]="_" (미지정)',
          snapshots: {
            v1: { entries: ['_', 'low', 'medium', 'high'] },
          },
        },
      },
      indices: {
        task: { dims: ['priority'], versions: { v1: { snapshots: { priority: 'v1' } } } },
      },
    });
    const PRIORITY = sdk.client('task', 'v1').constants('priority');

    expect(PRIORITY).toEqual({ low: 'low', medium: 'medium', high: 'high' });
    expect('_' in PRIORITY).toBe(false);
  });

  it('여러 예약 토큰(_, ~, ?)이 모두 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        category: {
          kind: { type: 'string_enum' as const },
          description: 'reserved: [1]="_" (미분류), [2]="~" (기타), [3]="?" (불명)',
          snapshots: {
            v1: { entries: ['_', '~', '?', 'tech', 'science'] },
          },
        },
      },
      indices: {
        item: { dims: ['category'], versions: { v1: { snapshots: { category: 'v1' } } } },
      },
    });
    const CATEGORY = sdk.client('item', 'v1').constants('category');

    expect(CATEGORY).toEqual({ tech: 'tech', science: 'science' });
    for (const token of RESERVED_TOKENS) {
      expect(token in CATEGORY).toBe(false);
    }
  });

  it('예약 토큰이 없는 dim은 모든 entries가 constants에 포함된다', () => {
    const sdk = trackingSchema();
    const ACTION = sdk.client('tracking', 'v1').constants('action');

    expect(Object.keys(ACTION)).toHaveLength(4);
    expect(ACTION).toEqual({
      click: 'click',
      view: 'view',
      scroll: 'scroll',
      submit: 'submit',
    });
  });

  it('entries()는 예약 토큰을 포함한 전체 배열을 반환한다', () => {
    const sdk = createIndexSDK({
      dims: {
        priority: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['_', 'low', 'medium', 'high'] },
          },
        },
      },
      indices: {
        task: { dims: ['priority'], versions: { v1: { snapshots: { priority: 'v1' } } } },
      },
    });
    // entries()는 raw 배열 — 예약 토큰 포함
    expect(sdk.client('task', 'v1').entries('priority')).toEqual(['_', 'low', 'medium', 'high']);
  });

  it('sdk.constants()에서도 예약 토큰이 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        priority: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['_', 'low', 'medium', 'high'] },
          },
        },
      },
      indices: {
        task: { dims: ['priority'], versions: { v1: { snapshots: { priority: 'v1' } } } },
      },
    });
    const PRIORITY = sdk.constants('priority', 'v1');

    expect(PRIORITY).toEqual({ low: 'low', medium: 'medium', high: 'high' });
  });
});

// ── constants: inactive 항목 제외 ────────────────────────────────────────────

describe('constants: inactive 항목 제외', () => {
  it('inactive 항목은 constants에서 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: {
              entries: ['read', 'write', 'delete'],
              entryFlags: {
                3: { status: 'inactive' as const, reason: 'deprecated', updatedAt: '2026-03-01' },
              },
            },
          },
        },
      },
      indices: {
        perm: { dims: ['action'], versions: { v1: { snapshots: { action: 'v1' } } } },
      },
    });
    const ACTION = sdk.client('perm', 'v1').constants('action');

    expect(ACTION).toEqual({ read: 'read', write: 'write' });
    expect('delete' in ACTION).toBe(false);
  });

  it('entries()는 inactive 항목을 포함한 전체 배열을 반환한다', () => {
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: {
              entries: ['read', 'write', 'delete'],
              entryFlags: {
                3: { status: 'inactive' as const, reason: 'deprecated', updatedAt: '2026-03-01' },
              },
            },
          },
        },
      },
      indices: {
        perm: { dims: ['action'], versions: { v1: { snapshots: { action: 'v1' } } } },
      },
    });
    // entries()는 raw — inactive 포함
    expect(sdk.client('perm', 'v1').entries('action')).toEqual(['read', 'write', 'delete']);
  });

  it('inactive + 예약 토큰이 동시에 있으면 둘 다 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: {
              entries: ['_', 'admin', 'editor', 'viewer'],
              entryFlags: {
                4: { status: 'inactive' as const, reason: 'removed', updatedAt: '2026-03-01' },
              },
            },
          },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { v1: { snapshots: { role: 'v1' } } } },
      },
    });
    const ROLE = sdk.client('perm', 'v1').constants('role');

    // "_"(예약) + "viewer"(inactive) 제외
    expect(ROLE).toEqual({ admin: 'admin', editor: 'editor' });
  });

  it('sdk.constants()에서도 inactive 항목이 제외된다', () => {
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: {
              entries: ['read', 'write', 'delete'],
              entryFlags: {
                3: { status: 'inactive' as const, reason: 'deprecated', updatedAt: '2026-03-01' },
              },
            },
          },
        },
      },
      indices: {
        perm: { dims: ['action'], versions: { v1: { snapshots: { action: 'v1' } } } },
      },
    });
    const ACTION = sdk.constants('action', 'v1');

    expect(ACTION).toEqual({ read: 'read', write: 'write' });
  });
});

// ── constants: reservedTokens 오버라이드 ──────────────────────────────────────

describe('constants: reservedTokens 오버라이드', () => {
  const schemaWithMarkers = () => ({
    dims: {
      category: {
        kind: { type: 'string_enum' as const },
        snapshots: {
          v1: { entries: ['_', '~', 'NaN', 'tech', 'science'] },
        },
      },
    },
    indices: {
      item: { dims: ['category'], versions: { v1: { snapshots: { category: 'v1' } } } },
    },
  });

  it('기본 RESERVED_TOKENS는 _, ~, ? 만 제외한다 (NaN은 포함)', () => {
    const sdk = createIndexSDK(schemaWithMarkers());
    const C = sdk.client('item', 'v1').constants('category');

    expect(C).toEqual({ NaN: 'NaN', tech: 'tech', science: 'science' });
  });

  it('reservedTokens 옵션으로 NaN도 제외할 수 있다', () => {
    const sdk = createIndexSDK(schemaWithMarkers(), {
      reservedTokens: new Set(['_', '~', '?', 'NaN']),
    });
    const C = sdk.client('item', 'v1').constants('category');

    expect(C).toEqual({ tech: 'tech', science: 'science' });
  });

  it('reservedTokens를 빈 Set으로 지정하면 모든 entry가 포함된다', () => {
    const sdk = createIndexSDK(schemaWithMarkers(), {
      reservedTokens: new Set(),
    });
    const C = sdk.client('item', 'v1').constants('category');

    expect(C).toEqual({
      _: '_',
      '~': '~',
      NaN: 'NaN',
      tech: 'tech',
      science: 'science',
    });
  });

  it('커스텀 토큰만 제외할 수 있다', () => {
    const sdk = createIndexSDK(schemaWithMarkers(), {
      reservedTokens: new Set(['NaN']),
    });
    const C = sdk.client('item', 'v1').constants('category');

    // NaN만 제외, _, ~ 는 포함
    expect(C).toEqual({ _: '_', '~': '~', tech: 'tech', science: 'science' });
  });

  it('sdk.constants()에도 reservedTokens 옵션이 적용된다', () => {
    const sdk = createIndexSDK(schemaWithMarkers(), {
      reservedTokens: new Set(['_', '~', '?', 'NaN']),
    });
    const C = sdk.constants('category', 'v1');

    expect(C).toEqual({ tech: 'tech', science: 'science' });
  });
});

// ── dimCapacity ──────────────────────────────────────────────────────────────

describe('dimCapacity', () => {
  it('capacity 미지정 시 headroom은 0이다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const cap = tracking.dimCapacity('action');

    expect(cap.total).toBe(4);
    expect(cap.capacity).toBe(4);
    expect(cap.headroom).toBe(0);
  });

  it('capacity를 entries보다 크게 설정하면 headroom이 양수다', () => {
    const sdk = createIndexSDK({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['admin', 'editor', 'viewer'], capacity: 8 },
          },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { v1: { snapshots: { role: 'v1' } } } },
      },
    });
    const cap = sdk.client('perm', 'v1').dimCapacity('role');

    expect(cap.total).toBe(3);
    expect(cap.capacity).toBe(8);
    expect(cap.headroom).toBe(5);
  });

  it('존재하지 않는 dimId는 DimNotFoundError', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    expect(() => tracking.dimCapacity('unknown')).toThrow(DimNotFoundError);
  });
});

// ── dimFullView ─────────────────────────────────────────────────────────────

describe('dimFullView', () => {
  it('capacity 미지정 시 entries만 포함하고 empty 없음', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const view = tracking.dimFullView('action');

    expect(view.dimId).toBe('action');
    expect(view.snapshotId).toBe('v1');
    expect(view.total).toBe(4);
    expect(view.capacity).toBe(4);
    expect(view.headroom).toBe(0);
    expect(view.positions).toHaveLength(4);

    // 모든 position이 normal
    for (const p of view.positions) {
      expect(p.kind).toBe('normal');
      expect(p.value).not.toBeNull();
    }
  });

  it('capacity > entries일 때 empty slot이 포함된다', () => {
    const sdk = createIndexSDK({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['admin', 'editor', 'viewer'], capacity: 8 },
          },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { v1: { snapshots: { role: 'v1' } } } },
      },
    });
    const view = sdk.client('perm', 'v1').dimFullView('role');

    expect(view.total).toBe(3);
    expect(view.capacity).toBe(8);
    expect(view.headroom).toBe(5);
    expect(view.positions).toHaveLength(8);

    // 1-3: normal, 4-8: empty
    const normals = view.positions.filter((p) => p.kind === 'normal');
    const empties = view.positions.filter((p) => p.kind === 'empty');

    expect(normals).toHaveLength(3);
    expect(empties).toHaveLength(5);

    // empty positions have null value
    for (const p of empties) {
      expect(p.value).toBeNull();
    }
  });

  it('예약 토큰이 reserved로 분류된다', () => {
    const sdk = createIndexSDK({
      dims: {
        category: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['_', '~', 'tech', 'science'], capacity: 8 },
          },
        },
      },
      indices: {
        item: { dims: ['category'], versions: { v1: { snapshots: { category: 'v1' } } } },
      },
    });
    const view = sdk.client('item', 'v1').dimFullView('category');

    expect(view.positions).toHaveLength(8);

    const reserved = view.positions.filter((p) => p.kind === 'reserved');
    const normals = view.positions.filter((p) => p.kind === 'normal');
    const empties = view.positions.filter((p) => p.kind === 'empty');

    expect(reserved).toHaveLength(2);
    expect(reserved[0]).toEqual({ position: 1, value: '_', kind: 'reserved' });
    expect(reserved[1]).toEqual({ position: 2, value: '~', kind: 'reserved' });

    expect(normals).toHaveLength(2);
    expect(normals[0]).toEqual({ position: 3, value: 'tech', kind: 'normal' });
    expect(normals[1]).toEqual({ position: 4, value: 'science', kind: 'normal' });

    expect(empties).toHaveLength(4);
  });

  it('커스텀 reservedTokens가 반영된다', () => {
    const sdk = createIndexSDK(
      {
        dims: {
          level: {
            kind: { type: 'string_enum' as const },
            snapshots: {
              v1: { entries: ['_', 'NaN', 'low', 'high'], capacity: 6 },
            },
          },
        },
        indices: {
          t: { dims: ['level'], versions: { v1: { snapshots: { level: 'v1' } } } },
        },
      },
      {
        reservedTokens: new Set(['_', '~', '?', 'NaN']),
      },
    );
    const view = sdk.client('t', 'v1').dimFullView('level');

    const reserved = view.positions.filter((p) => p.kind === 'reserved');
    expect(reserved).toHaveLength(2);
    expect(reserved.map((p) => p.value)).toEqual(['_', 'NaN']);
  });

  it('number_enum entries는 모두 normal이다 (예약 토큰은 string 전용)', () => {
    const sdk = createIndexSDK({
      dims: {
        score: {
          kind: { type: 'number_enum' as const },
          snapshots: {
            v1: { entries: [10, 20, 30], capacity: 5 },
          },
        },
      },
      indices: {
        t: { dims: ['score'], versions: { v1: { snapshots: { score: 'v1' } } } },
      },
    });
    const view = sdk.client('t', 'v1').dimFullView('score');

    const normals = view.positions.filter((p) => p.kind === 'normal');
    const empties = view.positions.filter((p) => p.kind === 'empty');

    expect(normals).toHaveLength(3);
    expect(empties).toHaveLength(2);
    expect(normals.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  it('position은 1-based로 연속된다', () => {
    const sdk = createIndexSDK({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['_', 'admin', 'editor'], capacity: 6 },
          },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { v1: { snapshots: { role: 'v1' } } } },
      },
    });
    const view = sdk.client('perm', 'v1').dimFullView('role');

    expect(view.positions.map((p) => p.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('반환값은 frozen이다', () => {
    const sdk = trackingSchema();
    const view = sdk.client('tracking', 'v1').dimFullView('action');
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.positions)).toBe(true);
  });

  it('존재하지 않는 dimId는 DimNotFoundError', () => {
    const sdk = trackingSchema();
    expect(() => sdk.client('tracking', 'v1').dimFullView('unknown')).toThrow(DimNotFoundError);
  });
});

// ── entries() vs dimFullView() 대비 ─────────────────────────────────────────

describe('entries() vs dimFullView(): 두 가지 엔트리 제공 모드', () => {
  const schemaWithCapacity = () =>
    createIndexSDK({
      dims: {
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: {
            v1: { entries: ['_', '~', 'admin', 'editor', 'viewer'], capacity: 10 },
          },
        },
      },
      indices: {
        perm: { dims: ['role'], versions: { v1: { snapshots: { role: 'v1' } } } },
      },
    });

  it('entries()는 등록된 entries만 반환한다 (capacity 정보 없음)', () => {
    const sdk = schemaWithCapacity();
    const perm = sdk.client('perm', 'v1');
    const e = perm.entries('role');

    // capacity 10이지만 entries는 5개만 반환
    expect(e).toEqual(['_', '~', 'admin', 'editor', 'viewer']);
    expect(e).toHaveLength(5);
  });

  it('dimFullView()는 전체 capacity 포함 주소 공간을 반환한다', () => {
    const sdk = schemaWithCapacity();
    const perm = sdk.client('perm', 'v1');
    const view = perm.dimFullView('role');

    // capacity 10이므로 10개 position
    expect(view.positions).toHaveLength(10);

    const reserved = view.positions.filter((p) => p.kind === 'reserved');
    const normals = view.positions.filter((p) => p.kind === 'normal');
    const empties = view.positions.filter((p) => p.kind === 'empty');

    expect(reserved).toHaveLength(2); // "_", "~"
    expect(normals).toHaveLength(3); // admin, editor, viewer
    expect(empties).toHaveLength(5); // headroom
  });

  it('constants()는 정규 도메인 값만 반환한다 (예약+inactive 제외)', () => {
    const sdk = schemaWithCapacity();
    const perm = sdk.client('perm', 'v1');
    const c = perm.constants('role');

    // reserved("_", "~") 제외, empty 제외
    expect(c).toEqual({ admin: 'admin', editor: 'editor', viewer: 'viewer' });
  });

  it('세 API의 반환 범위가 일관된다', () => {
    const sdk = schemaWithCapacity();
    const perm = sdk.client('perm', 'v1');

    const entries = perm.entries('role');
    const constants = perm.constants('role');
    const fullView = perm.dimFullView('role');
    const capacity = perm.dimCapacity('role');

    // entries는 등록된 것만
    expect(entries).toHaveLength(capacity.total);

    // constants는 예약 토큰 제외
    expect(Object.keys(constants)).toHaveLength(3); // admin, editor, viewer

    // fullView는 전체 capacity
    expect(fullView.positions).toHaveLength(capacity.capacity);

    // fullView의 non-empty positions = entries
    const populated = fullView.positions.filter((p) => p.kind !== 'empty');
    expect(populated).toHaveLength(entries.length);
    expect(populated.map((p) => p.value)).toEqual([...entries]);

    // fullView의 headroom = dimCapacity의 headroom
    const emptyCount = fullView.positions.filter((p) => p.kind === 'empty').length;
    expect(emptyCount).toBe(capacity.headroom);
  });
});

// ── matchRanges ──────────────────────────────────────────────────────────────

describe('matchRanges', () => {
  it('첫 번째 dim 고정 → 연속 범위', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    // action=click(pos1): (1-1)*12 = 0 → [0, 11]
    // shape [4, 4, 3], weights [12, 3, 1]
    expect(tracking.matchRanges({ action: 'click' })).toEqual([[0, 11]]);
  });

  it('전체 와일드카드 → [[0, size-1]]', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    expect(tracking.matchRanges({})).toEqual([[0, 47]]);
  });

  it('모든 dim 고정 → 단일 값 (encode와 일치)', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const input = { action: 'submit', page: 'checkout', userType: 'premium' };

    const ranges = tracking.matchRanges(input);
    const encoded = tracking.encode(input);

    expect(ranges).toEqual([[encoded.value, encoded.value]]);
  });
});

// ── toDecodeMap ──────────────────────────────────────────────────────────────

describe('toDecodeMap', () => {
  it('DecodeMap으로 독립 MetaCodec을 생성해 동일하게 동작한다', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    const map = tracking.toDecodeMap();
    const codec = new MetaCodec(map);

    const input = { action: 'view', page: 'product', userType: 'guest' };
    expect(codec.encode(input)).toEqual(tracking.encode(input));
  });

  it('JSON 직렬화 후에도 동작한다 (네트워크 전송 시나리오)', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');
    const vv = tracking.encode({ action: 'click', page: 'home', userType: 'member' });

    // 서버 → 클라이언트 전송 시뮬레이션
    const json = JSON.stringify(tracking.toDecodeMap());
    const received = JSON.parse(json);

    const remoteCodec = new MetaCodec(received);
    expect(remoteCodec.decode(vv)).toEqual({ action: 'click', page: 'home', userType: 'member' });
  });
});

// ── 멀티 인덱스 ──────────────────────────────────────────────────────────────

describe('멀티 인덱스 SDK', () => {
  it('하나의 SDK에서 여러 index client를 생성할 수 있다', () => {
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['click', 'view'] } },
        },
        role: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['admin', 'editor', 'viewer'] } },
        },
        resource: {
          kind: { type: 'string_enum' as const },
          snapshots: { v1: { entries: ['post', 'comment'] } },
        },
      },
      indices: {
        tracking: {
          dims: ['action'],
          versions: { v1: { snapshots: { action: 'v1' } } },
        },
        permission: {
          dims: ['role', 'resource'],
          versions: { v1: { snapshots: { role: 'v1', resource: 'v1' } } },
        },
      },
    });

    const tracking = sdk.client('tracking', 'v1');
    const permission = sdk.client('permission', 'v1');

    expect(tracking.size).toBe(2);
    expect(permission.size).toBe(6); // 3 × 2

    const tvv = tracking.encode({ action: 'click' });
    expect(tracking.decode(tvv)).toEqual({ action: 'click' });

    const pvv = permission.encode({ role: 'editor', resource: 'post' });
    expect(permission.decode(pvv)).toEqual({ role: 'editor', resource: 'post' });
  });
});

// ── 에러 처리 ────────────────────────────────────────────────────────────────

describe('에러 처리', () => {
  it('존재하지 않는 entity → EntryNotFoundError', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    expect(() => tracking.encode({ action: 'hover', page: 'home', userType: 'guest' })).toThrow(
      EntryNotFoundError,
    );
  });

  it('dim 누락 → ValidationError', () => {
    const sdk = trackingSchema();
    const tracking = sdk.client('tracking', 'v1');

    expect(() => tracking.encode({ action: 'click' })).toThrow(ValidationError);
  });

  it('다른 index의 VersionedValue decode → ValidationError', () => {
    const sdk = createIndexSDK({
      dims: {
        a: { kind: { type: 'string_enum' as const }, snapshots: { v1: { entries: ['x'] } } },
      },
      indices: {
        idx1: { dims: ['a'], versions: { v1: { snapshots: { a: 'v1' } } } },
        idx2: { dims: ['a'], versions: { v1: { snapshots: { a: 'v1' } } } },
      },
    });

    const c1 = sdk.client('idx1', 'v1');
    const c2 = sdk.client('idx2', 'v1');

    const vv = c1.encode({ a: 'x' });
    expect(() => c2.decode(vv)).toThrow(ValidationError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// prefix + version + entries → 안정적 전송 시나리오
//
// 사용자가 "click", "home" 같은 friendly name을 입력하면
// SDK가 { indexId(prefix), versionId(version), value(index) }로 묶어서 내보내고
// 수신 측에서 동일 스키마로 원본을 복원하는 전체 흐름을 검증한다.
// ══════════════════════════════════════════════════════════════════════════════

// ── 공유 스키마 정의 (패키지로 배포되는 것을 시뮬레이션) ─────────────────────

import type { MetaRegistryInput, VersionedValue } from 'index-meta';

const SHARED_SCHEMA: MetaRegistryInput = {
  dims: {
    action: {
      kind: { type: 'string_enum' },
      snapshots: {
        sv1: { entries: ['click', 'view', 'scroll', 'submit'] },
        sv2: { entries: ['click', 'view', 'scroll', 'submit', 'hover', 'focus'] },
      },
      migrations: [{ fromSnapshotId: 'sv1', toSnapshotId: 'sv2', indexMap: {} }],
    },
    page: {
      kind: { type: 'string_enum' },
      snapshots: {
        sv1: { entries: ['home', 'product', 'cart'] },
      },
    },
    userType: {
      kind: { type: 'string_enum' },
      snapshots: {
        sv1: { entries: ['guest', 'member', 'premium'] },
      },
    },
  },
  indices: {
    tracking: {
      dims: ['action', 'page', 'userType'],
      versions: {
        v1: { snapshots: { action: 'sv1', page: 'sv1', userType: 'sv1' } },
        v2: { snapshots: { action: 'sv2', page: 'sv1', userType: 'sv1' } },
      },
    },
  },
};

// ── 1. 결정적 인코딩 (Deterministic Encoding) ───────────────────────────────

describe('결정적 인코딩: 같은 입력 → 항상 같은 VersionedValue', () => {
  it('동일 입력을 반복 encode해도 동일한 { prefix, version, value }를 반환한다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    const input = { action: 'click', page: 'home', userType: 'member' };
    const results: VersionedValue[] = [];

    for (let i = 0; i < 100; i++) {
      results.push(tracking.encode(input));
    }

    // 100회 모두 동일한 값
    for (const vv of results) {
      expect(vv).toEqual(results[0]);
    }
  });

  it('entries 순서가 encoding value를 결정한다 (position-based)', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    // action dim: ["click"(pos1), "view"(pos2), "scroll"(pos3), "submit"(pos4)]
    // 첫 번째 dim의 position이 가장 높은 weight를 가짐
    const click = tracking.encode({ action: 'click', page: 'home', userType: 'guest' });
    const view = tracking.encode({ action: 'view', page: 'home', userType: 'guest' });
    const scroll = tracking.encode({ action: 'scroll', page: 'home', userType: 'guest' });
    const submit = tracking.encode({ action: 'submit', page: 'home', userType: 'guest' });

    // position 순서대로 value가 증가 (연속 블록)
    expect(click.value).toBeLessThan(view.value);
    expect(view.value).toBeLessThan(scroll.value);
    expect(scroll.value).toBeLessThan(submit.value);
  });

  it('별도 SDK 인스턴스에서도 동일 스키마면 동일 value를 생성한다', () => {
    const sdk1 = createIndexSDK(SHARED_SCHEMA);
    const sdk2 = createIndexSDK(SHARED_SCHEMA);

    const c1 = sdk1.client('tracking', 'v1');
    const c2 = sdk2.client('tracking', 'v1');

    const input = { action: 'scroll', page: 'cart', userType: 'premium' };
    expect(c1.encode(input)).toEqual(c2.encode(input));
  });
});

// ── 2. VersionedValue 와이어 포맷 ───────────────────────────────────────────

describe('VersionedValue 와이어 포맷: { indexId, versionId, value }', () => {
  it('encode 결과는 prefix(indexId) + version(versionId) + index(value)를 포함한다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    const vv = tracking.encode({ action: 'click', page: 'home', userType: 'guest' });

    // 3개 필드가 모두 존재하고 정확한 타입
    expect(vv).toHaveProperty('indexId', 'tracking');
    expect(vv).toHaveProperty('versionId', 'v1');
    expect(vv).toHaveProperty('value');
    expect(typeof vv.value).toBe('number');
    expect(vv.value).toBeGreaterThanOrEqual(0);
    expect(vv.value).toBeLessThan(tracking.size);

    // 추가 필드 없음 (순수 3-field 구조)
    expect(Object.keys(vv).toSorted()).toEqual(['indexId', 'value', 'versionId']);
  });

  it('JSON.stringify / JSON.parse round-trip이 가능하다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    const original = tracking.encode({ action: 'submit', page: 'cart', userType: 'premium' });
    const wire = JSON.stringify(original);
    const restored: VersionedValue = JSON.parse(wire);

    expect(restored).toEqual(original);
    expect(tracking.decode(restored)).toEqual({
      action: 'submit',
      page: 'cart',
      userType: 'premium',
    });
  });

  it('value는 0 이상 size 미만의 정수다 (전체 공간 검증)', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');
    const values = new Set<number>();

    for (const action of ['click', 'view', 'scroll', 'submit']) {
      for (const page of ['home', 'product', 'cart']) {
        for (const userType of ['guest', 'member', 'premium']) {
          const vv = tracking.encode({ action, page, userType });
          expect(Number.isInteger(vv.value)).toBe(true);
          expect(vv.value).toBeGreaterThanOrEqual(0);
          expect(vv.value).toBeLessThan(tracking.size);
          values.add(vv.value);
        }
      }
    }

    // 모든 조합이 고유한 value를 생성
    expect(values.size).toBe(4 * 3 * 3); // 36
  });
});

// ── 3. API 요청/응답 시뮬레이션 ─────────────────────────────────────────────

describe('API 요청/응답 시뮬레이션', () => {
  it('프론트엔드 encode → HTTP 전송 → 백엔드 decode', () => {
    // ── 프론트엔드 (브라우저) ──
    const frontendSDK = createIndexSDK(SHARED_SCHEMA);
    const feClient = frontendSDK.client('tracking', 'v1');
    const ACTION = feClient.constants('action');
    const PAGE = feClient.constants('page');

    const payload = feClient.encode({
      action: ACTION.click,
      page: PAGE.product,
      userType: 'member',
    });

    // HTTP request body (JSON)
    const requestBody = JSON.stringify(payload);

    // ── 백엔드 (Node.js) ──
    const backendSDK = createIndexSDK(SHARED_SCHEMA);
    const beClient = backendSDK.client('tracking', 'v1');

    const received: VersionedValue = JSON.parse(requestBody);
    const decoded = beClient.decode(received);

    expect(decoded).toEqual({
      action: 'click',
      page: 'product',
      userType: 'member',
    });
  });

  it('백엔드 DB 저장 → 조회 → 프론트엔드 응답', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    // 인코딩 후 DB에 저장하는 값
    const vv = tracking.encode({ action: 'view', page: 'product', userType: 'guest' });
    const dbRow = {
      pk: vv.value,
      index_id: vv.indexId,
      version_id: vv.versionId,
    };

    // DB에서 읽은 후 복원
    const restored: VersionedValue = {
      indexId: dbRow.index_id,
      versionId: dbRow.version_id,
      value: dbRow.pk,
    };

    expect(tracking.decode(restored)).toEqual({
      action: 'view',
      page: 'product',
      userType: 'guest',
    });
  });

  it('DB matchRanges → BETWEEN 쿼리로 부분 조회', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    // "click" 액션의 모든 이벤트 범위
    const ranges = tracking.matchRanges({ action: 'click' });

    // 해당 범위 내 모든 value를 decode하면 action=click
    for (const [from, to] of ranges) {
      for (let v = from; v <= to; v++) {
        const decoded = tracking.decodeValue(v);
        expect(decoded.action).toBe('click');
      }
    }

    // 범위 밖 value는 action≠click
    for (let v = 0; v < tracking.size; v++) {
      const inRange = ranges.some(([f, t]) => v >= f && v <= t);
      if (!inRange) {
        expect(tracking.decodeValue(v).action).not.toBe('click');
      }
    }
  });
});

// ── 4. 버전 진화 시 값 안정성 ────────────────────────────────────────────────

describe('버전 진화: v1 → v2에서 기존 entries의 encode 안정성', () => {
  it('v1 entries가 v2에서도 encode/decode 가능하다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const v1 = sdk.client('tracking', 'v1');
    const v2 = sdk.client('tracking', 'v2');

    // v1 entries로 v2 encode (click, view, scroll, submit은 v2에도 존재)
    const input = { action: 'click', page: 'home', userType: 'guest' };
    const vv2 = v2.encode(input);

    expect(v2.decode(vv2)).toEqual(input);
  });

  it('v2에서 추가된 entries는 v1에서 encode할 수 없다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const v1 = sdk.client('tracking', 'v1');

    // "hover", "focus"는 sv2에만 존재 → v1(sv1)에서는 불가
    expect(() => v1.encode({ action: 'hover', page: 'home', userType: 'guest' })).toThrow(
      EntryNotFoundError,
    );
  });

  it('v2에서 추가된 entries를 v2 client로 encode할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const v2 = sdk.client('tracking', 'v2');

    const vv = v2.encode({ action: 'hover', page: 'home', userType: 'guest' });
    expect(vv.indexId).toBe('tracking');
    expect(vv.versionId).toBe('v2');
    expect(v2.decode(vv)).toEqual({ action: 'hover', page: 'home', userType: 'guest' });
  });

  it('v1과 v2의 VersionedValue는 versionId로 구분된다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const v1 = sdk.client('tracking', 'v1');
    const v2 = sdk.client('tracking', 'v2');

    const input = { action: 'click', page: 'home', userType: 'guest' };
    const vv1 = v1.encode(input);
    const vv2 = v2.encode(input);

    // 같은 entity names이지만 version이 다름
    expect(vv1.versionId).toBe('v1');
    expect(vv2.versionId).toBe('v2');
    // indexId는 동일
    expect(vv1.indexId).toBe(vv2.indexId);
  });

  it('v1 VersionedValue를 v2 client로 decode하면 ValidationError', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const v1 = sdk.client('tracking', 'v1');
    const v2 = sdk.client('tracking', 'v2');

    const vv1 = v1.encode({ action: 'click', page: 'home', userType: 'guest' });
    // v1 value를 v2로 decode → version 불일치
    expect(() => v2.decode(vv1)).toThrow(ValidationError);
  });

  it('수신 측에서 versionId를 확인해 올바른 client로 라우팅할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);

    // 프론트엔드가 v1, v2 혼합 전송
    const v1 = sdk.client('tracking', 'v1');
    const v2 = sdk.client('tracking', 'v2');

    const payloads = [
      v1.encode({ action: 'click', page: 'home', userType: 'guest' }),
      v2.encode({ action: 'hover', page: 'product', userType: 'member' }),
      v1.encode({ action: 'submit', page: 'cart', userType: 'premium' }),
    ];

    // 백엔드에서 versionId 기반 라우팅
    for (const vv of payloads) {
      const client = sdk.client(vv.indexId, vv.versionId);
      const decoded = client.decode(vv);
      expect(decoded.action).toBeDefined();
      expect(decoded.page).toBeDefined();
      expect(decoded.userType).toBeDefined();
    }
  });
});

// ── 5. 상수 기반 워크플로 ────────────────────────────────────────────────────

describe('상수 기반 워크플로: constants → encode → decode', () => {
  it('모든 dim을 constants로 지정해 encode할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    const ACTION = tracking.constants('action');
    const PAGE = tracking.constants('page');
    const USER_TYPE = tracking.constants('userType');

    const vv = tracking.encode({
      action: ACTION.submit,
      page: PAGE.cart,
      userType: USER_TYPE.premium,
    });

    expect(tracking.decode(vv)).toEqual({
      action: 'submit',
      page: 'cart',
      userType: 'premium',
    });
  });

  it('constants 값과 문자열 직접 입력은 동일한 결과를 낸다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');
    const ACTION = tracking.constants('action');

    const withConst = tracking.encode({ action: ACTION.click, page: 'home', userType: 'guest' });
    const withString = tracking.encode({ action: 'click', page: 'home', userType: 'guest' });

    expect(withConst).toEqual(withString);
  });

  it('constants 객체의 키로 dim의 모든 값을 열거할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');
    const ACTION = tracking.constants('action');

    expect(Object.keys(ACTION).toSorted()).toEqual(['click', 'scroll', 'submit', 'view']);
  });
});

// ── 6. DecodeMap 기반 독립 소비 ──────────────────────────────────────────────

describe('DecodeMap 기반 독립 소비: SDK 없이 decode', () => {
  it('DecodeMap을 JSON으로 전달받은 서비스가 독립적으로 decode할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    // SDK가 있는 서비스에서 encode + DecodeMap 추출
    const vv = tracking.encode({ action: 'scroll', page: 'product', userType: 'member' });
    const mapJson = JSON.stringify(tracking.toDecodeMap());

    // SDK 없는 서비스에서 DecodeMap만으로 decode
    const receivedMap = JSON.parse(mapJson);
    const codec = new MetaCodec(receivedMap);

    expect(codec.decode(vv)).toEqual({
      action: 'scroll',
      page: 'product',
      userType: 'member',
    });
  });

  it('DecodeMap 기반 codec도 encode할 수 있다', () => {
    const sdk = createIndexSDK(SHARED_SCHEMA);
    const tracking = sdk.client('tracking', 'v1');

    const codec = new MetaCodec(tracking.toDecodeMap());
    const vv = codec.encode({ action: 'click', page: 'home', userType: 'guest' });

    // SDK client와 동일한 결과
    expect(vv).toEqual(tracking.encode({ action: 'click', page: 'home', userType: 'guest' }));
  });
});

// ── 7. 멀티 인덱스 실전 시나리오 ─────────────────────────────────────────────

describe('멀티 인덱스: 여러 prefix를 하나의 SDK로 관리', () => {
  const multiIndexSchema = (): MetaRegistryInput => ({
    dims: {
      action: {
        kind: { type: 'string_enum' },
        snapshots: { v1: { entries: ['click', 'view', 'scroll'] } },
      },
      role: {
        kind: { type: 'string_enum' },
        snapshots: { v1: { entries: ['admin', 'editor', 'viewer'] } },
      },
      resource: {
        kind: { type: 'string_enum' },
        snapshots: { v1: { entries: ['post', 'comment', 'user'] } },
      },
      page: {
        kind: { type: 'string_enum' },
        snapshots: { v1: { entries: ['dashboard', 'settings'] } },
      },
    },
    indices: {
      tracking: {
        dims: ['action', 'page'],
        versions: { v1: { snapshots: { action: 'v1', page: 'v1' } } },
      },
      permission: {
        dims: ['role', 'resource'],
        versions: { v1: { snapshots: { role: 'v1', resource: 'v1' } } },
      },
    },
  });

  it('서로 다른 prefix의 VersionedValue는 indexId로 구분된다', () => {
    const sdk = createIndexSDK(multiIndexSchema());
    const tracking = sdk.client('tracking', 'v1');
    const permission = sdk.client('permission', 'v1');

    const tvv = tracking.encode({ action: 'click', page: 'dashboard' });
    const pvv = permission.encode({ role: 'admin', resource: 'post' });

    expect(tvv.indexId).toBe('tracking');
    expect(pvv.indexId).toBe('permission');

    // 같은 value라도 indexId가 다르면 다른 의미
    // (우연히 같은 value가 나올 수 있지만 indexId로 구분)
  });

  it('수신 측에서 indexId로 적절한 client를 선택해 decode한다', () => {
    const sdk = createIndexSDK(multiIndexSchema());

    // 다양한 prefix의 payload가 섞여서 도착
    const tracking = sdk.client('tracking', 'v1');
    const permission = sdk.client('permission', 'v1');

    const mixed: VersionedValue[] = [
      tracking.encode({ action: 'click', page: 'dashboard' }),
      permission.encode({ role: 'editor', resource: 'comment' }),
      tracking.encode({ action: 'view', page: 'settings' }),
      permission.encode({ role: 'viewer', resource: 'user' }),
    ];

    // indexId 기반 라우팅으로 decode
    const results = mixed.map((vv) => {
      const client = sdk.client(vv.indexId, vv.versionId);
      return { prefix: vv.indexId, decoded: client.decode(vv) };
    });

    expect(results).toEqual([
      { prefix: 'tracking', decoded: { action: 'click', page: 'dashboard' } },
      { prefix: 'permission', decoded: { role: 'editor', resource: 'comment' } },
      { prefix: 'tracking', decoded: { action: 'view', page: 'settings' } },
      { prefix: 'permission', decoded: { role: 'viewer', resource: 'user' } },
    ]);
  });

  it('dim을 공유하는 indices가 각각 독립적으로 동작한다', () => {
    // action dim을 두 index가 공유하는 시나리오
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: 'string_enum' },
          snapshots: { v1: { entries: ['click', 'view'] } },
        },
        page: {
          kind: { type: 'string_enum' },
          snapshots: { v1: { entries: ['home', 'product'] } },
        },
        target: {
          kind: { type: 'string_enum' },
          snapshots: { v1: { entries: ['button', 'link', 'image'] } },
        },
      },
      indices: {
        pageView: {
          dims: ['action', 'page'],
          versions: { v1: { snapshots: { action: 'v1', page: 'v1' } } },
        },
        interaction: {
          dims: ['action', 'target'],
          versions: { v1: { snapshots: { action: 'v1', target: 'v1' } } },
        },
      },
    });

    const pageView = sdk.client('pageView', 'v1');
    const interaction = sdk.client('interaction', 'v1');

    // 같은 action="click"이지만 다른 index에서 사용
    const pv = pageView.encode({ action: 'click', page: 'home' });
    const ia = interaction.encode({ action: 'click', target: 'button' });

    expect(pv.indexId).toBe('pageView');
    expect(ia.indexId).toBe('interaction');

    expect(pageView.decode(pv)).toEqual({ action: 'click', page: 'home' });
    expect(interaction.decode(ia)).toEqual({ action: 'click', target: 'button' });
  });
});
