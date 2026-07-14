// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { createDefaultLoggerAdapter, type HostLoggerLike } from './default.js';
import type { SliceLogContext } from '../logger.port.js';

interface CapturedRecord {
  bindings: Record<string, unknown>;
  obj?: Record<string, unknown>;
  msg: string;
  level: 'info' | 'warn' | 'error';
}

function createCapturingHost(): { host: HostLoggerLike; records: CapturedRecord[] } {
  const records: CapturedRecord[] = [];
  function makeChild(bindings: Record<string, unknown>): HostLoggerLike {
    return {
      child: (b) => makeChild({ ...bindings, ...b }),
      info: ((a: unknown, b?: string) => {
        if (typeof a === 'string') records.push({ bindings, msg: a, level: 'info' });
        else
          records.push({
            bindings,
            obj: a as Record<string, unknown>,
            msg: b ?? '',
            level: 'info',
          });
      }) as HostLoggerLike['info'],
      warn: ((a: unknown, b?: string) => {
        if (typeof a === 'string') records.push({ bindings, msg: a, level: 'warn' });
        else
          records.push({
            bindings,
            obj: a as Record<string, unknown>,
            msg: b ?? '',
            level: 'warn',
          });
      }) as HostLoggerLike['warn'],
      error: ((a: unknown, b?: string) => {
        if (typeof a === 'string') records.push({ bindings, msg: a, level: 'error' });
        else
          records.push({
            bindings,
            obj: a as Record<string, unknown>,
            msg: b ?? '',
            level: 'error',
          });
      }) as HostLoggerLike['error'],
    };
  }
  return { host: makeChild({}), records };
}

describe('createDefaultLoggerAdapter', () => {
  const fullCtx: SliceLogContext = {
    traceId: 'trace-1',
    correlationId: 'corr-1',
    domain: 'assignment',
    useCase: 'create-assignment',
    aggregateId: 'agg-1',
    commandName: 'CreateAssignment',
    queryName: undefined,
    eventName: 'AssignmentCreated',
    eventVersion: 1,
    outcome: 'success',
    errorCode: undefined,
    cacheKeyPrefix: 'assignment:',
    cacheHit: false,
  };

  it('emits all SliceLogContext fields via child bindings on info', () => {
    const { host, records } = createCapturingHost();
    const port = createDefaultLoggerAdapter(host);
    port.info(fullCtx, 'ok');
    expect(records).toHaveLength(1);
    const rec = records[0]!;
    expect(rec.level).toBe('info');
    expect(rec.msg).toBe('ok');
    // every defined field must be present
    expect(rec.bindings.traceId).toBe('trace-1');
    expect(rec.bindings.correlationId).toBe('corr-1');
    expect(rec.bindings.domain).toBe('assignment');
    expect(rec.bindings.useCase).toBe('create-assignment');
    expect(rec.bindings.aggregateId).toBe('agg-1');
    expect(rec.bindings.commandName).toBe('CreateAssignment');
    expect(rec.bindings.eventName).toBe('AssignmentCreated');
    expect(rec.bindings.eventVersion).toBe(1);
    expect(rec.bindings.outcome).toBe('success');
    expect(rec.bindings.cacheKeyPrefix).toBe('assignment:');
    expect(rec.bindings.cacheHit).toBe(false);
    // undefined fields should be elided
    expect('queryName' in rec.bindings).toBe(false);
    expect('errorCode' in rec.bindings).toBe(false);
  });

  it('emits err key on error path', () => {
    const { host, records } = createCapturingHost();
    const port = createDefaultLoggerAdapter(host);
    const err = new Error('kaboom');
    port.error({ ...fullCtx, outcome: 'failure', errorCode: 'FAILED', err }, 'use-case failed');
    expect(records).toHaveLength(1);
    const rec = records[0]!;
    expect(rec.level).toBe('error');
    expect(rec.msg).toBe('use-case failed');
    expect(rec.bindings.outcome).toBe('failure');
    expect(rec.bindings.errorCode).toBe('FAILED');
    expect(rec.obj).toBeDefined();
    expect((rec.obj as { err: unknown }).err).toBe(err);
    // err must NOT leak into bindings
    expect('err' in rec.bindings).toBe(false);
  });

  it('emits warn with bindings', () => {
    const { host, records } = createCapturingHost();
    const port = createDefaultLoggerAdapter(host);
    port.warn({ domain: 'x', useCase: 'y' }, 'heads up');
    expect(records[0]?.level).toBe('warn');
    expect(records[0]?.bindings.domain).toBe('x');
  });

  it('does not invoke host directly when child is unused (sanity)', () => {
    const child = vi.fn();
    const host: HostLoggerLike = {
      child: ((b: Record<string, unknown>) => {
        child(b);
        return {
          child: () => host,
          info: () => {},
          warn: () => {},
          error: () => {},
        };
      }) as HostLoggerLike['child'],
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    const port = createDefaultLoggerAdapter(host);
    port.info({ domain: 'd', useCase: 'u' }, 'm');
    expect(child).toHaveBeenCalled();
  });
});
