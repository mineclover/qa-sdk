// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectController } from './project.controller.js';
import { ProjectUseCase } from '../../application/use-cases/project.use-case.js';
import { ProjectReadModelQuery } from '../../application/queries/project-read-model.query.js';
import { ProjectAccessService } from '../../application/services/project-access.service.js';
import { CurrentUserGuard } from '../../../../auth-deps/current-user.guard.js';
import { ProjectDomainException } from '../../domain/index.js';
import { mapDomainErrorToHttp } from '@qa-sdk/sim-domain-slice-kit';

async function build({
  useCase,
  readModel,
  access,
}: {
  useCase: Partial<ProjectUseCase>;
  readModel: Partial<ProjectReadModelQuery>;
  access: Partial<ProjectAccessService>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProjectController],
    providers: [
      { provide: ProjectUseCase, useValue: useCase },
      { provide: ProjectReadModelQuery, useValue: readModel },
      { provide: ProjectAccessService, useValue: access },
    ],
  })
    .overrideGuard(CurrentUserGuard)
    .useValue({ canActivate: () => true })
    .compile();
  return moduleRef.get(ProjectController);
}

const fakeUser = {
  userId: 'alice',
  bitmapMask: new Uint8Array([0xff]),
  bitmapVersion: 'uv1',
  roleIds: [],
  roleNames: [],
  roleAssignments: [],
  primaryRoleId: null,
  departmentId: null,
};

describe('ProjectController', () => {
  it('POST /projects — allow + 응답 shape', async () => {
    const detail = {
      id: 'p1',
      name: 'Demo',
      ownerId: 'alice',
      departmentId: 'd1',
      status: 'draft',
      createdAt: 'x',
      updatedAt: 'x',
    };
    const useCase = { create: vi.fn(async () => detail) };
    const access = {
      check: vi.fn(async () => ({ allow: true, rootSpanId: 'root-1' })),
    };
    const controller = await build({ useCase, readModel: {}, access });
    const res = await controller.create({ name: 'Demo', departmentId: 'd1' }, fakeUser as never);
    expect(res.rootSpanId).toBe('root-1');
    expect(res.name).toBe('Demo');
  });

  it('POST /projects — deny → ForbiddenException', async () => {
    const access = {
      check: vi.fn(async () => ({ allow: false, denyReason: 'x', rootSpanId: 'r' })),
    };
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: {},
      access,
    });
    await expect(
      controller.create({ name: 'X', departmentId: 'd' }, fakeUser as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('GET /projects/:id — 미존재 시 NotFoundException', async () => {
    const controller = await build({
      useCase: {},
      readModel: { findDetail: vi.fn(async () => null) },
      access: {},
    });
    await expect(controller.get('missing', fakeUser as never)).rejects.toThrow(NotFoundException);
  });

  it('GET /projects?ownerId=', async () => {
    const list = [
      {
        id: 'p1',
        name: 'A',
        ownerId: 'alice',
        departmentId: 'd',
        status: 'draft',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ];
    const controller = await build({
      useCase: {},
      readModel: { listByOwner: vi.fn(async () => list) },
      access: {},
    });
    expect(await controller.list(undefined as never, 'alice')).toEqual(list);
  });

  it('도메인 예외 → HTTP 매핑', () => {
    const err = new ProjectDomainException('PROJECT_ARCHIVED', 'archived');
    err.name = 'ConflictError';
    const { status } = mapDomainErrorToHttp(err, 'trc_x');
    expect(status).toBe(409);
  });
});
