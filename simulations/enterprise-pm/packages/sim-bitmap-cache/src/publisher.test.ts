// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { BitmapInvalidationPublisher } from './publisher.js';
import { INVALIDATION_CHANNEL, parseMessage } from './message.js';

describe('BitmapInvalidationPublisher', () => {
  it('publish — INVALIDATION_CHANNEL에 JSON 메시지 발행', async () => {
    const redis = new RedisMock() as unknown as Redis;
    const subscriber = (redis as RedisMock).duplicate() as unknown as Redis;
    await subscriber.subscribe(INVALIDATION_CHANNEL);

    const received: string[] = [];
    subscriber.on('message', (ch: string, msg: string) => {
      if (ch === INVALIDATION_CHANNEL) received.push(msg);
    });

    const publisher = new BitmapInvalidationPublisher({
      redis,
      publisherName: 'sim-auth-api',
    });
    await publisher.publishUserChange('user-1', 'permission_change');

    await new Promise((r) => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe('user');
    expect(parsed.target).toBe('user-1');
    expect(parsed.reason).toBe('permission_change');
    expect(parsed.publisher).toBe('sim-auth-api');
  });

  it('publishRoleChange — affectedUserIds 포함', async () => {
    const redis = new RedisMock() as unknown as Redis;
    const subscriber = (redis as RedisMock).duplicate() as unknown as Redis;
    await subscriber.subscribe(INVALIDATION_CHANNEL);
    const received: string[] = [];
    subscriber.on('message', (_ch: string, msg: string) => received.push(msg));

    const publisher = new BitmapInvalidationPublisher({
      redis,
      publisherName: 'sim-auth-api',
    });
    await publisher.publishRoleChange('role-admin', 'role_redefinition', ['u1', 'u2', 'u3']);
    await new Promise((r) => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe('role');
    expect(parsed.target).toBe('role-admin');
    expect(parsed.affectedUserIds).toEqual(['u1', 'u2', 'u3']);
  });

  it('publishPrefixBump — prefix_version_bump', async () => {
    const redis = new RedisMock() as unknown as Redis;
    const subscriber = (redis as RedisMock).duplicate() as unknown as Redis;
    await subscriber.subscribe(INVALIDATION_CHANNEL);
    const received: string[] = [];
    subscriber.on('message', (_ch: string, msg: string) => received.push(msg));

    const publisher = new BitmapInvalidationPublisher({
      redis,
      publisherName: 'sim-auth-api',
    });
    await publisher.publishPrefixBump('sim.bitmap', 'prefix_version_bump');
    await new Promise((r) => setTimeout(r, 50));

    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe('prefix');
    expect(parsed.target).toBe('sim.bitmap');
    expect(parsed.reason).toBe('prefix_version_bump');
  });

  it('publish 임의 메시지 (raw API)', async () => {
    const redis = new RedisMock() as unknown as Redis;
    const publishSpy = vi.spyOn(redis, 'publish');
    const publisher = new BitmapInvalidationPublisher({
      redis,
      publisherName: 'test',
    });
    await publisher.publish({
      scope: 'user',
      target: 'u',
      reason: 'security_incident',
      issuedAt: '2026-04-22T00:00:00.000Z',
      publisher: 'test',
    });
    expect(publishSpy).toHaveBeenCalledWith(INVALIDATION_CHANNEL, expect.any(String));
  });
});
