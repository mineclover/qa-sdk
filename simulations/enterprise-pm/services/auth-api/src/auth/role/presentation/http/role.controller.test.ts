// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { RoleController } from './role.controller.js';
import { RoleUseCase } from '../../application/use-cases/role.use-case.js';
import { RoleReadModelQuery } from '../../application/queries/role-read-model.query.js';

async function build(useCase: Partial<RoleUseCase>, readModel: Partial<RoleReadModelQuery>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [RoleController],
    providers: [
      { provide: RoleUseCase, useValue: useCase },
      { provide: RoleReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(RoleController);
}

describe('RoleController', () => {
  it('POST /roles → 생성 후 detail 반환', async () => {
    const detail = {
      id: 'role_admin',
      name: 'admin',
      scopeType: 'global',
      defaultMaskHex: 'ffff',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const useCase = {
      create: vi.fn(async () => ({ id: detail.id, status: 'ACTIVE' as const })),
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const controller = await build(useCase, readModel);
    const res = await controller.create({
      name: 'admin',
      scopeType: 'global',
      defaultMaskHex: 'ffff',
    });
    expect(res).toEqual(detail);
  });

  it('GET /roles → list', async () => {
    const list = [
      { id: 'r1', name: 'admin', scopeType: 'global', defaultMaskHex: 'ff', createdAt: 'x' },
    ];
    const controller = await build({ create: vi.fn() }, { list: vi.fn(async () => list) });
    expect(await controller.list()).toEqual(list);
  });

  it('GET 미존재 시 NotFoundError', async () => {
    const controller = await build({ create: vi.fn() }, { findDetail: vi.fn(async () => null) });
    await expect(controller.get('missing')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('DELETE 응답', async () => {
    const useCase = { delete: vi.fn(async () => ({ id: 'r1', status: 'DELETED' as const })) };
    const controller = await build(useCase, {});
    expect(await controller.remove('r1')).toEqual({ status: 'deleted' });
  });
});
