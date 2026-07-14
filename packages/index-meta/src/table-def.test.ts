// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect } from 'vitest';
import { defineTable } from './table-def.js';
import { ValidationError } from './errors.js';

// ── 공통 픽스처 ────────────────────────────────────────────

const leafInput = () => ({
  source: { kind: { type: 'string_enum' as const } },
  versions: { v1: { capacity: 8 } },
});

const roleTable = () =>
  defineTable('role', {
    source: { kind: { type: 'string_enum' as const } },
    versions: { v1: { capacity: 8 }, v2: { capacity: 16 } },
  });

const actionTable = () =>
  defineTable('action', {
    source: { kind: { type: 'string_enum' as const } },
    versions: { v1: { capacity: 4 } },
  });

// ── ID 검증 ───────────────────────────────────────────────

describe('defineTable — id 검증', () => {
  it('id가 비어있으면 ValidationError', () => {
    expect(() => defineTable('', leafInput())).toThrow(ValidationError);
  });

  it('id에 콜론이 있으면 ValidationError', () => {
    expect(() => defineTable('ro:le', leafInput())).toThrow(ValidationError);
  });
});

// ── leaf / composite 구분 ─────────────────────────────────

describe('defineTable — leaf / composite 구분', () => {
  it('source 없이 dims 없으면 ValidationError', () => {
    expect(() => defineTable('x', { versions: { v1: { capacity: 4 } } })).toThrow(ValidationError);
  });

  it('source와 dims를 동시에 선언하면 ValidationError', () => {
    const role = roleTable();
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        dims: [role],
        versions: { v1: { refs: { role: { prefix: 'role', version: 'v1' } } } },
      }),
    ).toThrow(ValidationError);
  });

  it("leaf는 _type이 'table'이고 source를 갖는다", () => {
    const t = roleTable();
    expect(t._type).toBe('table');
    expect(t.source?.kind.type).toBe('string_enum');
    expect(t.dims).toBeUndefined();
  });

  it('composite는 dims를 갖고 source가 없다', () => {
    const role = roleTable();
    const action = actionTable();
    const perm = defineTable('perm', {
      dims: [role, action],
      versions: {
        v1: {
          refs: {
            role: { prefix: 'role', version: 'v1' },
            action: { prefix: 'action', version: 'v1' },
          },
        },
      },
    });
    expect(perm.source).toBeUndefined();
    expect(perm.dims).toHaveLength(2);
  });
});

// ── leaf version 검증 ─────────────────────────────────────

describe('defineTable — leaf version 검증', () => {
  it('versions가 비어있으면 ValidationError', () => {
    expect(() =>
      defineTable('x', { source: { kind: { type: 'string_enum' as const } }, versions: {} }),
    ).toThrow(ValidationError);
  });

  it('versionId가 비어있으면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { '': { capacity: 4 } },
      }),
    ).toThrow(ValidationError);
  });

  it('versionId에 콜론이 있으면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { 'v:1': { capacity: 4 } },
      }),
    ).toThrow(ValidationError);
  });

  it('capacity가 0이면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { v1: { capacity: 0 } },
      }),
    ).toThrow(ValidationError);
  });

  it('capacity가 음수이면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { v1: { capacity: -1 } },
      }),
    ).toThrow(ValidationError);
  });

  it('capacity가 소수이면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { v1: { capacity: 1.5 } },
      }),
    ).toThrow(ValidationError);
  });

  it('leaf version에 refs가 있으면 ValidationError', () => {
    expect(() =>
      defineTable('x', {
        source: { kind: { type: 'string_enum' as const } },
        versions: { v1: { refs: {} } as any },
      }),
    ).toThrow(ValidationError);
  });

  it('여러 버전 선언이 허용된다', () => {
    const t = roleTable();
    expect(Object.keys(t.versions)).toEqual(['v1', 'v2']);
    expect((t.versions.v1 as any).capacity).toBe(8);
    expect((t.versions.v2 as any).capacity).toBe(16);
  });
});

// ── composite version 검증 ────────────────────────────────

describe('defineTable — composite version 검증', () => {
  it('dim refs 누락 시 ValidationError', () => {
    const role = roleTable();
    const action = actionTable();
    expect(() =>
      defineTable('perm', {
        dims: [role, action],
        versions: {
          v1: {
            refs: {
              role: { prefix: 'role', version: 'v1' },
              // action 누락
            },
          },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('선언되지 않은 dim ref가 있으면 ValidationError', () => {
    const role = roleTable();
    expect(() =>
      defineTable('perm', {
        dims: [role],
        versions: {
          v1: {
            refs: {
              role: { prefix: 'role', version: 'v1' },
              ghost: { prefix: 'ghost', version: 'v1' }, // dims에 없음
            },
          },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('ref.prefix가 dimId와 다르면 ValidationError', () => {
    const role = roleTable();
    expect(() =>
      defineTable('perm', {
        dims: [role],
        versions: {
          v1: {
            refs: { role: { prefix: 'other', version: 'v1' } },
          },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('ref.version이 비어있으면 ValidationError', () => {
    const role = roleTable();
    expect(() =>
      defineTable('perm', {
        dims: [role],
        versions: {
          v1: { refs: { role: { prefix: 'role', version: '' } } },
        },
      }),
    ).toThrow(ValidationError);
  });

  it('composite version에 capacity가 있으면 ValidationError', () => {
    const role = roleTable();
    expect(() =>
      defineTable('perm', {
        dims: [role],
        versions: { v1: { capacity: 8 } as any },
      }),
    ).toThrow(ValidationError);
  });
});

// ── 반환값 불변성 ─────────────────────────────────────────

describe('defineTable — 반환값', () => {
  it('dims 배열은 원본과 독립적인 복사본이다', () => {
    const role = roleTable();
    const action = actionTable();
    const dimsInput = [role, action];
    const perm = defineTable('perm', {
      dims: dimsInput,
      versions: {
        v1: {
          refs: {
            role: { prefix: 'role', version: 'v1' },
            action: { prefix: 'action', version: 'v1' },
          },
        },
      },
    });
    dimsInput.push(roleTable()); // 원본 배열 변경
    expect(perm.dims).toHaveLength(2); // 영향 없음
  });

  it('description이 전달되면 그대로 보존된다', () => {
    const t = defineTable('role', {
      ...leafInput(),
      description: '사용자 역할',
    });
    expect(t.description).toBe('사용자 역할');
  });
});
