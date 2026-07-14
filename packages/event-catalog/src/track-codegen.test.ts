import { describe, it, expect } from 'vitest';
import { generateTrackCode, summarizeMappings } from './track-codegen.js';
import type { EventPrefixMapping } from './prefix-mapping.js';

const mappings: EventPrefixMapping[] = [
  {
    event_key: 'cart.add',
    domain: 'commerce',
    prefixes: [
      { prefixId: 'cart_event', dims: { action: { kind: 'fixed', value: 'add' } } },
      { prefixId: 'tracking', dims: { page: { kind: 'context', contextKey: 'page' } } },
    ],
  },
  {
    event_key: 'auth.login',
    domain: 'auth',
    prefixes: [
      { prefixId: 'auth_event', dims: { action: { kind: 'fixed', value: 'login' } } },
      { prefixId: 'endpoint', dims: { method: { kind: 'payload', payloadKey: 'method' } } },
    ],
  },
  {
    event_key: 'page.view',
    domain: 'navigation',
    prefixes: [{ prefixId: 'page_view', dims: { page: { kind: 'context', contextKey: 'page' } } }],
  },
];

describe('generateTrackCode', () => {
  it('이벤트별 track 함수 생성', () => {
    const code = generateTrackCode(mappings, { header: false });

    expect(code).toContain('export function trackCartAdd(');
    expect(code).toContain('export function trackAuthLogin(');
    expect(code).toContain('export function trackPageView(');
  });

  it('payload 필드가 있으면 타입 파라미터 포함', () => {
    const code = generateTrackCode(mappings, { header: false });

    // auth.login은 payload에서 method를 추출 → 타입 선언 포함
    expect(code).toContain('method: unknown');
    expect(code).toContain(`qa.track("auth.login", payload)`);
  });

  it('payload 없으면 optional payload', () => {
    const code = generateTrackCode(mappings, { header: false });

    // page.view는 context 기반만 → optional payload
    expect(code).toContain('payload?: Record<string, unknown>');
  });

  it('JSDoc 포함', () => {
    const code = generateTrackCode(mappings, { header: false, jsdoc: true });

    expect(code).toContain('* cart.add 이벤트 추적');
    expect(code).toContain('* 도메인: commerce');
    expect(code).toContain('* prefix: cart_event, tracking');
  });

  it('커스텀 trackerVar', () => {
    const code = generateTrackCode(mappings, { header: false, trackerVar: 'analytics' });

    expect(code).toContain(`analytics.track("cart.add"`);
    expect(code).toContain('analytics: AutoTracker');
  });

  it('헤더 포함', () => {
    const code = generateTrackCode(mappings, { header: true });

    expect(code).toContain('자동 생성된 track 함수');
    expect(code).toContain('직접 수정 금지');
  });

  it('빈 매핑 → import만 생성', () => {
    const code = generateTrackCode([], { header: false });

    expect(code).toContain('import type { AutoTracker }');
    expect(code).not.toContain('export function');
  });
});

describe('summarizeMappings', () => {
  it('이벤트별 요약 반환', () => {
    const summary = summarizeMappings(mappings);

    expect(summary).toHaveLength(3);
    expect(summary[0]).toEqual({
      eventKey: 'cart.add',
      funcName: 'trackCartAdd',
      prefixes: ['cart_event', 'tracking'],
      payloadFields: [],
    });
    expect(summary[1].payloadFields).toEqual(['method']);
  });
});
