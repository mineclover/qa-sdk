// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { describe, it, expect } from 'vitest';
import {
  formatServiceRef,
  parseServiceRef,
  createServiceContext,
  validateServiceIdentity,
} from 'permission-engine';

describe('validateServiceIdentity', () => {
  it('유효한 identity', () => {
    expect(validateServiceIdentity({ namespace: 'shop', name: 'payment' })).toEqual([]);
    expect(validateServiceIdentity({ namespace: 'cms', name: 'auth-svc' })).toEqual([]);
  });

  it('대문자 거부', () => {
    expect(validateServiceIdentity({ namespace: 'Shop', name: 'payment' }).length).toBeGreaterThan(
      0,
    );
  });

  it('빈 문자열 거부', () => {
    expect(validateServiceIdentity({ namespace: '', name: 'payment' }).length).toBeGreaterThan(0);
  });

  it('숫자 시작 거부', () => {
    expect(validateServiceIdentity({ namespace: '1shop', name: 'payment' }).length).toBeGreaterThan(
      0,
    );
  });
});

describe('formatServiceRef', () => {
  it('기본: namespace/name', () => {
    expect(formatServiceRef({ namespace: 'shop', name: 'payment' })).toBe('shop/payment');
  });

  it('컨텍스트 포함', () => {
    expect(
      formatServiceRef(
        { namespace: 'shop', name: 'payment', env: 'prod', region: 'asia' },
        { includeContext: true },
      ),
    ).toBe('shop/payment@prod.asia');
  });

  it('컨텍스트 전체 포함', () => {
    expect(
      formatServiceRef(
        { namespace: 'shop', name: 'payment', env: 'prod', region: 'asia', build: 'v2' },
        { includeContext: true },
      ),
    ).toBe('shop/payment@prod.asia.v2');
  });

  it('컨텍스트 없으면 @ 없음', () => {
    expect(formatServiceRef({ namespace: 'shop', name: 'payment' }, { includeContext: true })).toBe(
      'shop/payment',
    );
  });
});

describe('parseServiceRef', () => {
  it('기본 파싱', () => {
    const ref = parseServiceRef('shop/payment');
    expect(ref.namespace).toBe('shop');
    expect(ref.name).toBe('payment');
    expect(ref.env).toBeUndefined();
  });

  it('컨텍스트 포함 파싱', () => {
    const ref = parseServiceRef('shop/payment@prod.asia.v2');
    expect(ref.namespace).toBe('shop');
    expect(ref.name).toBe('payment');
    expect(ref.env).toBe('prod');
    expect(ref.region).toBe('asia');
    expect(ref.build).toBe('v2');
  });

  it('잘못된 형식 throw', () => {
    expect(() => parseServiceRef('no-slash')).toThrow('namespace/name');
    expect(() => parseServiceRef('123/bad')).toThrow('Invalid');
  });
});

describe('createServiceContext', () => {
  it('기본 생성', () => {
    const ctx = createServiceContext({
      namespace: 'shop',
      name: 'payment',
      env: 'prod',
      region: 'asia',
    });
    expect(ctx.identity).toEqual({ namespace: 'shop', name: 'payment' });
    expect(ctx.deploy).toEqual({ env: 'prod', region: 'asia', build: undefined });
    expect(ctx.ref()).toBe('shop/payment');
    expect(ctx.refFull()).toBe('shop/payment@prod.asia');
  });

  it('deploy 없이 생성', () => {
    const ctx = createServiceContext({ namespace: 'cms', name: 'auth' });
    expect(ctx.ref()).toBe('cms/auth');
    expect(ctx.refFull()).toBe('cms/auth');
  });

  it('잘못된 identity throw', () => {
    expect(() => createServiceContext({ namespace: '', name: 'x' })).toThrow();
  });
});
