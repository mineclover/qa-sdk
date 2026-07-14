// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import type { AuditRecorder } from 'permission-engine';
import { AuditRecorderQueryAdapter } from './audit-recorder-query.adapter.js';

function makeMockRecorder(overrides: Partial<AuditRecorder> = {}): AuditRecorder {
  return {
    listByRoot: vi.fn(async () => []),
    firstFailure: vi.fn(async () => null),
    get: vi.fn(async () => null),
    startExecution: vi.fn(async () => ({}) as never),
    finishExecution: vi.fn(async () => ({}) as never),
    recordCheck: vi.fn(async () => ({}) as never),
    ...overrides,
  };
}

describe('AuditRecorderQueryAdapter', () => {
  it('listByRoot 위임', async () => {
    const recorder = makeMockRecorder();
    const adapter = new AuditRecorderQueryAdapter(recorder);
    await adapter.listByRoot('root-1');
    expect(recorder.listByRoot).toHaveBeenCalledWith('root-1');
  });

  it('firstFailure 위임', async () => {
    const recorder = makeMockRecorder();
    const adapter = new AuditRecorderQueryAdapter(recorder);
    await adapter.firstFailure('root-1');
    expect(recorder.firstFailure).toHaveBeenCalledWith('root-1');
  });

  it('get 위임', async () => {
    const recorder = makeMockRecorder();
    const adapter = new AuditRecorderQueryAdapter(recorder);
    await adapter.get('span-1');
    expect(recorder.get).toHaveBeenCalledWith('span-1');
  });
});
