// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { CommentUseCase } from './comment.use-case.js';
import { CommentEntity } from '../../domain/index.js';
import type { CommentRepositoryPort } from '../ports/comment-repository.port.js';
import type { CommentOutboxPort, CommentOutboxRecord } from '../ports/comment-outbox.port.js';
import type {
  CommentTransactionPort,
  CommentTransactionScope,
} from '../ports/comment-transaction.port.js';
import type { CommentLoggerPort } from '../ports/comment-logger.port.js';
import type { DocumentQueryPort } from '../ports/document-query.port.js';

function makeMocks(opts: { documentExists?: boolean } = {}) {
  const calls: string[] = [];
  const scope: CommentTransactionScope = {
    id: 'tx-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const transaction: CommentTransactionPort = {
    async run<T>(_n: string, work: (s: CommentTransactionScope) => Promise<T>): Promise<T> {
      calls.push('transaction.run.start');
      const r = await work(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };

  let stored: CommentEntity | null = null;
  const repository: CommentRepositoryPort = {
    save: vi.fn(async (e: CommentEntity) => {
      calls.push('repository.save');
      stored = e;
    }),
    findById: vi.fn(async () => stored),
    listByDocument: vi.fn(async () => []),
    listReplies: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push('repository.delete');
      stored = null;
    }),
  };

  const outboxRecords: CommentOutboxRecord[] = [];
  const outbox: CommentOutboxPort = {
    append: vi.fn(async (r: CommentOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(r);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: CommentLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? 'started'}`);
      logged.push({ level: 'info', ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => logged.push({ level: 'warn', ctx: ctx as never, msg }),
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? '?'}`);
      logged.push({ level: 'error', ctx: ctx as never, msg });
    },
  };

  const documentQuery: DocumentQueryPort = {
    findSummary: vi.fn(async () =>
      opts.documentExists !== false ? { id: 'doc_001', title: 'Spec', projectId: 'p' } : null,
    ),
  };

  return { transaction, repository, outbox, outboxRecords, logger, logged, calls, documentQuery };
}

describe('CommentUseCase.create', () => {
  const command = {
    id: 'cmt_001',
    documentId: 'doc_001',
    authorId: 'usr_001',
    body: 'Looks good',
    traceId: 'trc_a',
    correlationId: 'cor_a',
  };

  it('documentQuery + transaction + repo + outbox 호출 순서', async () => {
    const m = makeMocks();
    const useCase = new CommentUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await useCase.create(command);
    expect(m.documentQuery.findSummary).toHaveBeenCalledWith('doc_001');
    expect(m.calls).toEqual([
      'logger.info:started',
      'transaction.run.start',
      'repository.save',
      'outbox.append',
      'transaction.run.commit',
      'logger.info:success',
    ]);
  });

  it('문서 미존재 시 NotFoundError + outcome=failure', async () => {
    const m = makeMocks({ documentExists: false });
    const useCase = new CommentUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await expect(useCase.create(command)).rejects.toMatchObject({
      name: 'NotFoundError',
    });
    expect(m.calls).toContain('logger.error:failure');
  });

  it('outbox 페이로드는 documentId/authorId/body 포함', async () => {
    const m = makeMocks();
    const useCase = new CommentUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await useCase.create(command);
    expect(m.outboxRecords[0].payload).toMatchObject({
      id: 'cmt_001',
      documentId: 'doc_001',
      body: 'Looks good',
    });
  });
});

describe('CommentUseCase.delete', () => {
  it('repository.delete + outbox 발행', async () => {
    const m = makeMocks();
    const useCase = new CommentUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.documentQuery,
    );
    await useCase.delete({ id: 'cmt_d1' });
    expect(m.calls).toContain('repository.delete');
    expect(m.outboxRecords.find((r) => r.eventName === 'document.comment.deleted')).toBeDefined();
  });
});
