import { describe, it, expect } from 'vitest';
import { createIndexSDK } from '@qa-sdk/codec';

// ── 테스트 스키마 (as const로 리터럴 타입 보존) ──────────────────────────────

const SCHEMA = {
  axes: {
    role: { entries: ['admin', 'editor', 'viewer'] },
    action: { entries: ['read', 'write', 'delete'] },
    region: { entries: ['asia', 'usa', 'eu'], capacity: 8 },
  },
  prefixes: {
    permission: { dims: ['role', 'action'] },
    regional: { dims: ['region'] },
    access: { dims: ['role', 'action', 'region'] },
  },
} as const;

const sdk = createIndexSDK(SCHEMA);

describe('TypedIndexSDK', () => {
  // ── 기본 라운드트립 ────────────────────────────────────────────────────────

  it('encode/decode 라운드트립 — 다차원 prefix', () => {
    const addr = sdk.encode('permission', { role: 'admin', action: 'read' });
    expect(typeof addr).toBe('number');

    const decoded = sdk.decode('permission', addr);
    expect(decoded.role).toBe('admin');
    expect(decoded.action).toBe('read');
  });

  it('encode/decode 라운드트립 — 1차원 prefix', () => {
    const addr = sdk.encode('regional', { region: 'usa' });
    const decoded = sdk.decode('regional', addr);
    expect(decoded.region).toBe('usa');
  });

  it('encode/decode 라운드트립 — 3차원 prefix', () => {
    const addr = sdk.encode('access', { role: 'viewer', action: 'delete', region: 'eu' });
    const decoded = sdk.decode('access', addr);
    expect(decoded.role).toBe('viewer');
    expect(decoded.action).toBe('delete');
    expect(decoded.region).toBe('eu');
  });

  // ── 전수 라운드트립 (permission: 3×3 = 9) ────────────────────────────────

  it('전수 라운드트립 — 모든 좌표에 대해 encode → decode 정합성', () => {
    const roles = SCHEMA.axes.role.entries;
    const actions = SCHEMA.axes.action.entries;
    const seen = new Set<number>();

    for (const role of roles) {
      for (const action of actions) {
        const addr = sdk.encode('permission', { role, action });
        expect(seen.has(addr)).toBe(false); // 전단사: 중복 없음
        seen.add(addr);

        const decoded = sdk.decode('permission', addr);
        expect(decoded.role).toBe(role);
        expect(decoded.action).toBe(action);
      }
    }
    expect(seen.size).toBe(roles.length * actions.length);
  });

  // ── capacity 헤드룸 ────────────────────────────────────────────────────────

  it('capacity가 entries.length보다 클 때 정상 동작', () => {
    // region: entries 3개, capacity 8
    const addr = sdk.encode('regional', { region: 'eu' });
    const decoded = sdk.decode('regional', addr);
    expect(decoded.region).toBe('eu');
  });

  // ── 에러 케이스 ─────────────────────────────────────────────────────────────

  it('존재하지 않는 prefix → 런타임 에러', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sdk as any).encode('unknown_prefix', {});
    }).toThrow(/Unknown prefix/);
  });

  it('잘못된 entry 값 → 런타임 에러', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sdk as any).encode('permission', { role: 'nobody', action: 'read' });
    }).toThrow(/Unknown entry/);
  });

  it('누락된 차원 → 런타임 에러', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sdk as any).encode('permission', { role: 'admin' });
    }).toThrow(/Missing dim/);
  });

  // ── 타입 레벨 검증 (컴파일 타임 오류 확인) ──────────────────────────────────

  it('타입 레벨 — 잘못된 entry → @ts-expect-error', () => {
    expect(() => {
      // @ts-expect-error "nobody"는 role의 유효 entry가 아님
      sdk.encode('permission', { role: 'nobody', action: 'read' });
    }).toThrow(/Unknown entry/);
  });

  it('타입 레벨 — 잘못된 prefix → @ts-expect-error', () => {
    expect(() => {
      // @ts-expect-error "nonexistent"는 유효한 prefix가 아님
      sdk.encode('nonexistent', {});
    }).toThrow(/Unknown prefix/);
  });

  it('타입 레벨 — 누락된 차원 → @ts-expect-error', () => {
    expect(() => {
      // @ts-expect-error action이 누락됨
      sdk.encode('permission', { role: 'admin' });
    }).toThrow(/Missing dim/);
  });

  it('타입 레벨 — 잘못된 차원 키 → @ts-expect-error', () => {
    // @ts-expect-error "unknown_dim"은 permission의 차원이 아님
    sdk.encode('permission', { role: 'admin', action: 'read', unknown_dim: 'x' });
  });

  // ── 서로 다른 prefix의 주소 독립성 ───────────────────────────────────────────

  it('서로 다른 prefix의 동일 값은 독립적 주소 공간', () => {
    // permission과 access는 role/action을 공유하지만 별도 prefix
    const permAddr = sdk.encode('permission', { role: 'admin', action: 'read' });
    const accessAddr = sdk.encode('access', { role: 'admin', action: 'read', region: 'asia' });
    // 주소값 자체를 비교하는 것은 의미 없지만, 각각 독립적으로 decode 가능
    const permDecoded = sdk.decode('permission', permAddr);
    const accessDecoded = sdk.decode('access', accessAddr);
    expect(permDecoded.role).toBe('admin');
    expect(accessDecoded.role).toBe('admin');
    expect(accessDecoded.region).toBe('asia');
  });

  // ── 스키마 정의 오류 ──────────────────────────────────────────────────────

  it('스키마에 없는 axis 참조 시 팩토리 단계에서 에러', () => {
    expect(() => {
      createIndexSDK({
        axes: { role: { entries: ['admin'] } },
        prefixes: { bad: { dims: ['role', 'missing_axis'] } },
      } as const);
    }).toThrow(/unknown axis/i);
  });
});
