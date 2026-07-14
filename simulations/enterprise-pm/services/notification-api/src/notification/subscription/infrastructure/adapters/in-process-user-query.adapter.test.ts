// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import {
  InProcessSubscriptionUserQuery,
  type UserReadModelLike,
} from './in-process-user-query.adapter.js';

describe('InProcessSubscriptionUserQuery', () => {
  it('read-model 이 detail 을 반환하면 true', async () => {
    const readModel: UserReadModelLike = {
      findDetail: vi.fn(async (id: string) => ({ id, email: `${id}@x`, displayName: id })),
    };
    const adapter = new InProcessSubscriptionUserQuery(readModel);
    expect(await adapter.userExists('u1')).toBe(true);
    expect(readModel.findDetail).toHaveBeenCalledWith('u1');
  });

  it('read-model 이 null 을 반환하면 false', async () => {
    const readModel: UserReadModelLike = {
      findDetail: vi.fn(async () => null),
    };
    const adapter = new InProcessSubscriptionUserQuery(readModel);
    expect(await adapter.userExists('missing')).toBe(false);
  });

  it('read-model 미주입 시 fail-open (true)', async () => {
    const adapter = new InProcessSubscriptionUserQuery();
    expect(await adapter.userExists('any')).toBe(true);
  });

  it('read-model 이 throw 하면 fail-open (true)', async () => {
    const readModel: UserReadModelLike = {
      findDetail: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const adapter = new InProcessSubscriptionUserQuery(readModel);
    expect(await adapter.userExists('u1')).toBe(true);
  });
});
