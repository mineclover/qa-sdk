// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PATTERNS,
  validateResourceForType,
  formatPermCode,
  parsePermCode,
  createPermCodeFactory,
  createServiceContext,
  type PermissionCode,
  type PermCodeFactory,
} from 'permission-engine';

const SERIALIZATION_CASES = [
  {
    label: 'api',
    code: {
      service: 'shop/payment',
      type: 'api',
      resource: 'admin/teams',
      action: 'GET',
    },
    text: 'shop/payment.api.admin/teams.GET',
  },
  {
    label: 'page',
    code: {
      service: 'cms/portal',
      type: 'page',
      resource: 'admin/users',
      action: 'view',
    },
    text: 'cms/portal.page.admin/users.view',
  },
  {
    label: 'action',
    code: {
      service: 'ops/audit',
      type: 'action',
      resource: 'users/roles',
      action: 'approve',
    },
    text: 'ops/audit.action.users/roles.approve',
  },
  {
    label: 'single segment resource',
    code: {
      service: 'shop/auth',
      type: 'api',
      resource: 'login',
      action: 'POST',
    },
    text: 'shop/auth.api.login.POST',
  },
  {
    label: 'api with param resource',
    code: {
      service: 'shop/payment',
      type: 'api',
      resource: 'admin/teams/:teamId/members',
      action: 'GET',
    },
    text: 'shop/payment.api.admin/teams/:teamId/members.GET',
  },
] satisfies Array<{
  label: string;
  code: PermissionCode;
  text: string;
}>;

const ctx = createServiceContext({
  namespace: 'shop',
  name: 'payment',
  env: 'prod',
  region: 'asia',
});

describe('permission-code public exports', () => {
  it('PermissionCode contract is usable as the public serialization shape', () => {
    const code: PermissionCode = {
      service: 'shop/payment',
      type: 'api',
      resource: 'admin/teams',
      action: 'GET',
    };

    expect(formatPermCode(code)).toBe('shop/payment.api.admin/teams.GET');
  });

  it('PermCodeFactory contract remains callable with a .format helper', () => {
    const perm: PermCodeFactory = createPermCodeFactory(ctx);
    const code: PermissionCode = perm('api', 'admin/teams', 'GET');

    expect(code.service).toBe('shop/payment');
    expect(perm.format('api', 'admin/teams', 'GET')).toBe('shop/payment.api.admin/teams.GET');
  });
});

describe('formatPermCode', () => {
  it.each(SERIALIZATION_CASES)('serializes $label permission codes', ({ code, text }) => {
    expect(formatPermCode(code)).toBe(text);
  });
});

describe('parsePermCode', () => {
  it.each(SERIALIZATION_CASES)('parses $label permission codes', ({ code, text }) => {
    expect(parsePermCode(text)).toEqual(code);
  });

  it.each(SERIALIZATION_CASES)(
    'roundtrips $label permission codes through format → parse → format',
    ({ text }) => {
      expect(formatPermCode(parsePermCode(text))).toBe(text);
    },
  );

  it.each([
    {
      label: 'missing all separators',
      raw: 'no-dots',
      message: '형식 필요',
    },
    {
      label: 'missing type/resource/action tail',
      raw: 'shop/payment.api',
      message: 'type.resource.action 부분 없음',
    },
    {
      label: 'missing resource/action separator',
      raw: 'shop/payment.api.admin/teams',
      message: 'resource.action 구분 없음',
    },
    {
      label: 'empty service',
      raw: '.api.admin/teams.GET',
      message: '빈 파트 존재',
    },
    {
      label: 'empty type',
      raw: 'shop/payment..admin/teams.GET',
      message: '빈 파트 존재',
    },
    {
      label: 'empty resource',
      raw: 'shop/payment.api..GET',
      message: '빈 파트 존재',
    },
    {
      label: 'empty action',
      raw: 'shop/payment.api.admin/teams.',
      message: '빈 파트 존재',
    },
  ])('rejects $label', ({ raw, message }) => {
    expect(() => parsePermCode(raw)).toThrow(RangeError);
    expect(() => parsePermCode(raw)).toThrow(message);
  });

  it('rejects non-string inputs such as null', () => {
    expect(() => parsePermCode(null as unknown as string)).toThrow(RangeError);
    expect(() => parsePermCode(null as unknown as string)).toThrow('string 형식 필요');
  });
});

describe('createPermCodeFactory', () => {
  it('binds ServiceContext via ref() and canonicalizes resources', () => {
    const perm: PermCodeFactory = createPermCodeFactory(ctx);
    const code: PermissionCode = perm('api', '  admin/teams  ', 'GET');

    expect(code).toEqual({
      service: 'shop/payment',
      type: 'api',
      resource: 'admin/teams',
      action: 'GET',
    });
    expect(code.service).toBe(ctx.ref());
    expect(code.service).not.toContain('@');
  });

  it('factory.format matches formatPermCode output', () => {
    const perm = createPermCodeFactory(ctx);
    const code = perm('page', 'admin/users', 'view');

    expect(perm.format('page', 'admin/users', 'view')).toBe(formatPermCode(code));
  });

  it('rejects invalid resources during canonicalization', () => {
    const perm = createPermCodeFactory(ctx);
    expect(() => perm('api', '/admin/teams', 'GET')).toThrow('Invalid resource');
  });
});

describe('permission code type-specific resource patterns', () => {
  it('page forbids params and limits depth to 3', () => {
    expect(DEFAULT_PATTERNS.page).toMatchObject({
      allowParams: false,
      maxDepth: 3,
    });

    const valid = parsePermCode('cms/portal.page.admin/users.view');
    expect(validateResourceForType(valid.resource, valid.type)).toEqual([]);
    expect(
      validateResourceForType('admin/:userId', 'page').some((error) => error.rule === 'no-params'),
    ).toBe(true);
    expect(
      validateResourceForType('a/b/c/d', 'page').some((error) => error.rule === 'max-depth'),
    ).toBe(true);
  });

  it('api allows params and limits depth to 4', () => {
    expect(DEFAULT_PATTERNS.api).toMatchObject({
      allowParams: true,
      maxDepth: 4,
    });

    const valid = parsePermCode('shop/payment.api.admin/teams/:teamId/members.GET');
    expect(validateResourceForType(valid.resource, valid.type)).toEqual([]);
    expect(validateResourceForType('a/b/c/d', 'api')).toEqual([]);
    expect(
      validateResourceForType('a/b/c/d/e', 'api').some((error) => error.rule === 'max-depth'),
    ).toBe(true);
  });

  it('action forbids params and limits depth to 3', () => {
    expect(DEFAULT_PATTERNS.action).toMatchObject({
      allowParams: false,
      maxDepth: 3,
    });

    const valid = parsePermCode('ops/audit.action.users/roles.approve');
    expect(validateResourceForType(valid.resource, valid.type)).toEqual([]);
    expect(
      validateResourceForType('users/:roleId', 'action').some(
        (error) => error.rule === 'no-params',
      ),
    ).toBe(true);
    expect(
      validateResourceForType('a/b/c/d', 'action').some((error) => error.rule === 'max-depth'),
    ).toBe(true);
  });
});
