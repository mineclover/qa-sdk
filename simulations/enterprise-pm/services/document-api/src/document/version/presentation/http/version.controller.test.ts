// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { VersionController } from './version.controller.js';
import { VersionUseCase } from '../../application/use-cases/version.use-case.js';
import { VersionReadModelQuery } from '../../application/queries/version-read-model.query.js';

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<VersionUseCase>;
  readModel: Partial<VersionReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [VersionController],
    providers: [
      { provide: VersionUseCase, useValue: useCase },
      { provide: VersionReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(VersionController);
}

describe('VersionController', () => {
  it('POST /documents/:id/versions — CREATED', async () => {
    const useCase = {
      create: vi.fn(async (cmd: { documentId: string }) => ({
        documentId: cmd.documentId,
        versionNumber: 1,
        status: 'CREATED' as const,
      })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.create('doc_1', { contentRef: 'k', authorId: 'u' });
    expect(res).toEqual({ documentId: 'doc_1', versionNumber: 1, status: 'CREATED' });
  });

  it('POST 입력 검증 실패', async () => {
    const controller = await build({ useCase: { create: vi.fn() }, readModel: {} });
    await expect(controller.create('doc_1', { contentRef: '' })).rejects.toThrow();
  });

  it('GET — 리스트', async () => {
    const items = [
      {
        documentId: 'd',
        versionNumber: 1,
        contentRef: 'k',
        authorId: 'u',
        createdAt: 'x',
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listByDocument: vi.fn(async () => items) },
    });
    expect(await controller.list('d')).toEqual(items);
  });

  it('GET 미존재 → NotFoundError', async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get('d', '1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
