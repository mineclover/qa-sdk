// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { NoopCredentialStore, TestCredentialStore } from './credential-store.port.js';

describe('NoopCredentialStore', () => {
  it('verify는 항상 false 반환', async () => {
    const store = new NoopCredentialStore();
    expect(await store.verify('alice@example.com', 'test123')).toBe(false);
  });
});

describe('TestCredentialStore', () => {
  it('set 후 verify 일치 → true', async () => {
    const store = new TestCredentialStore();
    store.set('alice@example.com', 'test123');
    expect(await store.verify('alice@example.com', 'test123')).toBe(true);
  });

  it('set 후 verify 비일치 → false', async () => {
    const store = new TestCredentialStore();
    store.set('alice@example.com', 'test123');
    expect(await store.verify('alice@example.com', 'wrong')).toBe(false);
  });

  it('set 안 된 email → false', async () => {
    const store = new TestCredentialStore();
    expect(await store.verify('unknown@example.com', 'any')).toBe(false);
  });

  it('reset — 모든 credential 제거', async () => {
    const store = new TestCredentialStore();
    store.set('alice@example.com', 'test123');
    store.reset();
    expect(await store.verify('alice@example.com', 'test123')).toBe(false);
  });
});
