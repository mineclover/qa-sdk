import { describe, it, expect } from 'vitest';
import { encode, decode, track, withServiceOverlay, BROWSER_CATALOG } from './index.js';

describe('@qa-sdk/browser-codec smoke test', () => {
  it('BROWSER_CATALOG has prefixes', () => {
    expect(Object.keys(BROWSER_CATALOG).length).toBeGreaterThan(10);
    expect(BROWSER_CATALOG['service']).toBeDefined();
    expect(BROWSER_CATALOG['tracking']).toBeDefined();
    expect(BROWSER_CATALOG.service.dims.svc_name.entries).toContain('roleplay-web');
    expect(BROWSER_CATALOG.service.dims.svc_name.entries).toContain('viteplus-sdk-smoke');
  });

  it('encode/decode roundtrip — tracking', () => {
    const result = encode(BROWSER_CATALOG, 'tracking', {
      svc_ref: BROWSER_CATALOG.tracking.dims.svc_ref.values![0],
      trackAction: 'click',
      page: 'home',
      userType: 'guest',
    });
    expect(result).not.toBeNull();
    expect(result!.address).toBeGreaterThanOrEqual(0);
    expect(result!.serialized).toMatch(/^tracking:v\d+:\d+$/);

    const decoded = decode(BROWSER_CATALOG, result!.serialized);
    expect(decoded).not.toBeNull();
    expect(decoded!.values.trackAction).toBe('click');
    expect(decoded!.values.page).toBe('home');
    expect(decoded!.values.userType).toBe('guest');
  });

  it('encode/decode roundtrip — rbac', () => {
    const result = encode(BROWSER_CATALOG, 'rbac', {
      role: 'admin',
      action: 'read',
      resource: 'dashboard',
    });
    expect(result).not.toBeNull();

    const decoded = decode(BROWSER_CATALOG, result!.serialized);
    expect(decoded).not.toBeNull();
    expect(decoded!.values.role).toBe('admin');
    expect(decoded!.values.action).toBe('read');
    expect(decoded!.values.resource).toBe('dashboard');
  });

  it('track returns address_context', () => {
    const ctx = track(BROWSER_CATALOG, {
      tracking: {
        svc_ref: BROWSER_CATALOG.tracking.dims.svc_ref.values![0],
        trackAction: 'click',
        page: 'home',
        userType: 'guest',
      },
    });
    expect(ctx).toBeDefined();
    expect(ctx['tracking']).toMatch(/^tracking:v/);
  });

  it('encode returns null when a prefix_ref dim is missing or unknown', () => {
    expect(encode(BROWSER_CATALOG, 'tracking', {
      trackAction: 'click',
      page: 'home',
      userType: 'guest',
    })).toBeNull();

    expect(encode(BROWSER_CATALOG, 'tracking', {
      svc_ref: 999999,
      trackAction: 'click',
      page: 'home',
      userType: 'guest',
    })).toBeNull();
  });

  it('decode returns null when address is malformed or outside capacity', () => {
    expect(decode(BROWSER_CATALOG, 'tracking:v3:999999')).toBeNull();
    expect(decode(BROWSER_CATALOG, 'tracking:v3:1abc')).toBeNull();
    expect(decode(BROWSER_CATALOG, 'tracking:v3:1e3')).toBeNull();
  });

  it('track fills missing prefix_ref dims from catalog defaults', () => {
    const ctx = track(BROWSER_CATALOG, {
      tracking: { trackAction: 'click', page: 'home', userType: 'guest' },
    });
    expect(ctx.tracking).toMatch(/^tracking:v\d+:\d+$/);

    const decoded = decode(BROWSER_CATALOG, ctx.tracking);
    expect(decoded?.values.svc_ref).toBe(BROWSER_CATALOG.tracking.dims.svc_ref.values![0]);
    expect(decoded?.values.trackAction).toBe('click');
  });

  it('encode with invalid prefix returns null', () => {
    const result = encode(BROWSER_CATALOG, 'nonexistent_prefix', {
      foo: 'bar',
    });
    expect(result).toBeNull();
  });

  it('decode with wrong prefix returns null', () => {
    const result = decode(BROWSER_CATALOG, 'nonexistent_prefix:v1:0');
    expect(result).toBeNull();
  });

  it('withServiceOverlay adds a local service entry for browser proof', () => {
    const catalog = withServiceOverlay(BROWSER_CATALOG, {
      env: 'local',
      region: 'asia',
      svc_name: 'confirm-web',
      namespace: 'shop',
    });

    const ctx = track(catalog, {
      service: {
        env: 'local',
        region: 'asia',
        svc_name: 'confirm-web',
        namespace: 'shop',
      },
    });

    expect(ctx.service).toMatch(/^service:v\d+:\d+$/);
    const decoded = decode(catalog, ctx.service);
    expect(decoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'confirm-web',
      namespace: 'shop',
    });
  });
});
