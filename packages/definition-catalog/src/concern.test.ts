// @def.doc definition-concern

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDefinitionRegistry } from './registry.js';
import {
  CONCERN_DEFS,
  getConcernDef,
  extractDirectConcerns,
  computeEffectiveConcerns,
} from './concern.js';
import type { DefinitionEntryInput } from './types.js';

function makeEntry(overrides: Partial<DefinitionEntryInput>): DefinitionEntryInput {
  const now = new Date().toISOString();
  return {
    id: `doc-${Math.random().toString(36).slice(2, 8)}`,
    title: '테스트',
    scope: 'feature',
    aspect: 'func_def',
    depth: 'specification',
    lifecycle: 'approved',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Concern 정의 ────────────────────────────────────────

describe('CONCERN_DEFS', () => {
  it('7개 concern이 정의되어 있다', () => {
    expect(CONCERN_DEFS.length).toBe(7);
  });

  it('모든 concern에 전파 규칙이 있다', () => {
    for (const def of CONCERN_DEFS) {
      expect(def.propagation.length).toBeGreaterThan(0);
    }
  });

  it('getConcernDef로 조회할 수 있다', () => {
    expect(getConcernDef('security')).toBeDefined();
    expect(getConcernDef('security')!.name).toBe('보안');
  });
});

// ─── 직접 concern 추출 ──────────────────────────────────

describe('extractDirectConcerns', () => {
  it('tags에서 concern만 추출한다', () => {
    const entry = makeEntry({ tags: ['security', 'cross-scope', 'performance', 'custom-tag'] });
    const reg = new MemoryDefinitionRegistry();
    const registered = reg.register(entry);
    const concerns = extractDirectConcerns(registered);
    expect(concerns).toEqual(['security', 'performance']);
  });

  it('tags가 없으면 빈 배열', () => {
    const entry = makeEntry({});
    const reg = new MemoryDefinitionRegistry();
    const registered = reg.register(entry);
    expect(extractDirectConcerns(registered)).toEqual([]);
  });
});

// ─── Concern 전파 ────────────────────────────────────────

describe('computeEffectiveConcerns', () => {
  let reg: MemoryDefinitionRegistry;

  beforeEach(() => {
    reg = new MemoryDefinitionRegistry();
  });

  function compute(targetId: string) {
    return computeEffectiveConcerns(
      targetId,
      (id) => reg.get(id),
      (id, dir) => reg.getLinks(id, dir),
    );
  }

  it('직접 concern만 있는 문서', () => {
    reg.register(makeEntry({ id: 'a', tags: ['security'] }));
    const result = compute('a');
    expect(result.direct).toEqual(['security']);
    expect(result.inherited).toEqual([]);
    expect(result.all).toEqual(['security']);
  });

  it('refines를 통한 downstream 전파', () => {
    // B(상위, security) ← A(하위, refines B)
    reg.register(makeEntry({ id: 'overview', depth: 'overview', tags: ['security'] }));
    reg.register(makeEntry({ id: 'spec', depth: 'specification' }));
    reg.link('spec', 'overview', 'refines');

    const result = compute('spec');
    expect(result.direct).toEqual([]);
    expect(result.inherited.length).toBe(1);
    expect(result.inherited[0].concern).toBe('security');
    expect(result.inherited[0].from).toBe('overview');
    expect(result.inherited[0].via).toBe('refines');
    expect(result.all).toEqual(['security']);
  });

  it('implements를 통한 downstream 전파', () => {
    // 명세(security) ← 구현(implements 명세)
    reg.register(
      makeEntry({ id: 'api-spec', scope: 'interface', aspect: 'api_contract', tags: ['security'] }),
    );
    reg.register(makeEntry({ id: 'component', scope: 'ui', aspect: 'component' }));
    reg.link('component', 'api-spec', 'implements');

    const result = compute('component');
    expect(result.all).toContain('security');
    expect(result.inherited[0].from).toBe('api-spec');
    expect(result.inherited[0].via).toBe('implements');
  });

  it('depends_on을 통한 upstream 전파', () => {
    // A depends_on B(migration) → A에 migration 상속
    reg.register(
      makeEntry({ id: 'schema', scope: 'data', aspect: 'domain_data', tags: ['migration'] }),
    );
    reg.register(makeEntry({ id: 'api', scope: 'interface', aspect: 'api_contract' }));
    reg.link('api', 'schema', 'depends_on');

    const result = compute('api');
    expect(result.all).toContain('migration');
    expect(result.inherited[0].from).toBe('schema');
    expect(result.inherited[0].via).toBe('depends_on');
  });

  it('constrains를 통한 downstream 전파', () => {
    // 보안제약(security) --constrains--> 컴포넌트 → 컴포넌트에 security 상속
    reg.register(
      makeEntry({
        id: 'sec-rule',
        scope: 'constraint',
        aspect: 'tech_constraint',
        tags: ['security'],
      }),
    );
    reg.register(makeEntry({ id: 'comp', scope: 'ui', aspect: 'component' }));
    reg.link('sec-rule', 'comp', 'constrains');

    const result = compute('comp');
    expect(result.all).toContain('security');
    expect(result.inherited[0].from).toBe('sec-rule');
    expect(result.inherited[0].via).toBe('constrains');
  });

  it('다단계 전이적 전파 (2-hop)', () => {
    // 개요(security) ← 명세(refines) ← 구현(implements)
    // 구현에서 2-hop으로 security가 전파되어야 한다
    reg.register(makeEntry({ id: 'top', depth: 'overview', tags: ['security'] }));
    reg.register(makeEntry({ id: 'mid', depth: 'specification' }));
    reg.register(makeEntry({ id: 'bot', depth: 'implementation' }));
    reg.link('mid', 'top', 'refines');
    reg.link('bot', 'mid', 'implements');

    const result = compute('bot');
    expect(result.all).toContain('security');
    expect(result.inherited[0].from).toBe('top');
    expect(result.inherited[0].path.length).toBe(3); // bot → mid → top
  });

  it('복수 concern 동시 전파', () => {
    reg.register(makeEntry({ id: 'parent', depth: 'overview', tags: ['security', 'performance'] }));
    reg.register(makeEntry({ id: 'child', depth: 'specification' }));
    reg.link('child', 'parent', 'refines');

    const result = compute('child');
    expect(result.all).toContain('security');
    expect(result.all).toContain('performance');
    expect(result.inherited.length).toBe(2);
  });

  it('직접 + 상속 concern 혼합', () => {
    reg.register(makeEntry({ id: 'parent', depth: 'overview', tags: ['security'] }));
    reg.register(makeEntry({ id: 'child', depth: 'specification', tags: ['testing'] }));
    reg.link('child', 'parent', 'refines');

    const result = compute('child');
    expect(result.direct).toEqual(['testing']);
    expect(result.inherited.length).toBe(1);
    expect(result.inherited[0].concern).toBe('security');
    expect(result.all).toContain('security');
    expect(result.all).toContain('testing');
  });

  it('traces_to는 전파하지 않는다', () => {
    reg.register(makeEntry({ id: 'decision', depth: 'overview', tags: ['security'] }));
    reg.register(makeEntry({ id: 'doc', depth: 'specification' }));
    reg.link('doc', 'decision', 'traces_to');

    const result = compute('doc');
    expect(result.all).not.toContain('security');
    expect(result.inherited).toEqual([]);
  });

  it('순환 참조에 안전하다', () => {
    reg.register(makeEntry({ id: 'a', scope: 'flow', aspect: 'process_flow', tags: ['security'] }));
    reg.register(makeEntry({ id: 'b', scope: 'flow', aspect: 'user_scenario' }));
    reg.link('a', 'b', 'depends_on');
    reg.link('b', 'a', 'depends_on');

    // 무한 루프 없이 완료되어야 함
    const result = compute('b');
    expect(result.all).toContain('security');
  });

  it('미등록 문서는 빈 결과', () => {
    const result = compute('nonexistent');
    expect(result.direct).toEqual([]);
    expect(result.inherited).toEqual([]);
    expect(result.all).toEqual([]);
  });
});

// ─── 실제 시나리오: 인증 시스템 ──────────────────────────

describe('시나리오: 인증 시스템 concern 전파', () => {
  let reg: MemoryDefinitionRegistry;

  beforeEach(() => {
    reg = new MemoryDefinitionRegistry();

    // 인증 시스템 문서 그래프
    reg.register(
      makeEntry({
        id: 'auth-overview',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
        tags: ['security'],
      }),
    );
    reg.register(
      makeEntry({
        id: 'auth-api',
        scope: 'interface',
        aspect: 'api_contract',
        depth: 'specification',
      }),
    );
    reg.register(
      makeEntry({
        id: 'auth-state',
        scope: 'state',
        aspect: 'domain_state',
        depth: 'specification',
      }),
    );
    reg.register(
      makeEntry({
        id: 'login-component',
        scope: 'ui',
        aspect: 'component',
        depth: 'implementation',
      }),
    );
    reg.register(
      makeEntry({
        id: 'sec-constraint',
        scope: 'constraint',
        aspect: 'tech_constraint',
        depth: 'specification',
        tags: ['security'],
      }),
    );

    // 관계
    reg.link('auth-api', 'auth-overview', 'refines');
    reg.link('auth-state', 'auth-overview', 'refines');
    reg.link('login-component', 'auth-api', 'implements');
    reg.link('auth-api', 'auth-state', 'depends_on');
    reg.link('sec-constraint', 'login-component', 'constrains');
  });

  function compute(id: string) {
    return computeEffectiveConcerns(
      id,
      (i) => reg.get(i),
      (i, d) => reg.getLinks(i, d),
    );
  }

  it('auth-overview: 직접 security', () => {
    const r = compute('auth-overview');
    expect(r.direct).toEqual(['security']);
    expect(r.inherited).toEqual([]);
  });

  it('auth-api: refines를 통해 security 상속', () => {
    const r = compute('auth-api');
    expect(r.all).toContain('security');
    expect(r.inherited.some((i) => i.from === 'auth-overview' && i.via === 'refines')).toBe(true);
  });

  it('login-component: implements + constrains 두 경로로 security 상속', () => {
    const r = compute('login-component');
    expect(r.all).toContain('security');
    // constrains 경로: sec-constraint → login-component
    expect(r.inherited.some((i) => i.from === 'sec-constraint' && i.via === 'constrains')).toBe(
      true,
    );
    // implements → refines 전이 경로: login-component → auth-api → auth-overview
    expect(r.inherited.some((i) => i.from === 'auth-overview')).toBe(true);
  });

  it('auth-state: refines를 통해 security 상속', () => {
    const r = compute('auth-state');
    expect(r.all).toContain('security');
    expect(r.inherited.some((i) => i.from === 'auth-overview')).toBe(true);
  });
});
