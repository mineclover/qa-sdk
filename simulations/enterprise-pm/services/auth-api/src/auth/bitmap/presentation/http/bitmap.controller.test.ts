// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BitmapController } from './bitmap.controller.js';
import { BitmapIssueQuery } from '../../application/queries/bitmap-issue.query.js';

async function build(query: Partial<BitmapIssueQuery>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [BitmapController],
    providers: [{ provide: BitmapIssueQuery, useValue: query }],
  }).compile();
  return moduleRef.get(BitmapController);
}

describe('BitmapController', () => {
  it('POST /bitmap/issue → wire shape', async () => {
    const mask = new Uint8Array([0xff, 0x00]);
    const query = {
      issueForUser: vi.fn(async () => ({
        prefix: 'sim.bitmap',
        v: 'v1',
        mask,
        issuedAt: 100,
        expiresAt: 200,
        issuer: 'sim-auth-api',
        signature: 'abcd',
      })),
    };
    const controller = await build(query);
    const res = await controller.issue({ userId: 'u_1' });
    expect(res).toMatchObject({
      prefix: 'sim.bitmap',
      v: 'v1',
      maskBase64: Buffer.from(mask).toString('base64'),
      issuedAt: 100,
      expiresAt: 200,
      issuer: 'sim-auth-api',
      signature: 'abcd',
    });
  });

  it('user 미존재 시 NotFoundError 도메인 예외', async () => {
    const controller = await build({ issueForUser: vi.fn(async () => null) });
    await expect(controller.issue({ userId: 'missing' })).rejects.toMatchObject({
      name: 'NotFoundError',
      code: 'USER_NOT_FOUND_FOR_BITMAP',
    });
  });
});
