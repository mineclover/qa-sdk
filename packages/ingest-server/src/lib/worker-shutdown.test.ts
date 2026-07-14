// @def.boundary ingest-system
// @def.doc ingest-system

import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { installWorkerShutdown } from './worker-shutdown.js';

function createLogger() {
  return pino({ level: 'silent' });
}

function createDeferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve,
  };
}

describe('installWorkerShutdown', () => {
  it('registers SIGTERM and SIGINT handlers', () => {
    const on = vi.fn();

    installWorkerShutdown({
      close: async () => {},
      logger: createLogger(),
      process: { on },
    });

    expect(on).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenNthCalledWith(1, 'SIGTERM', expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(2, 'SIGINT', expect.any(Function));
  });

  it('waits for close to finish before exiting', async () => {
    const exitCodes: number[] = [];
    const deferred = createDeferred();
    const close = vi.fn(async () => {
      await deferred.promise;
    });
    const { shutdown } = installWorkerShutdown({
      close,
      exit: (code) => {
        exitCodes.push(code);
      },
      logger: createLogger(),
    });

    const shutdownPromise = shutdown('SIGTERM');

    expect(close).toHaveBeenCalledOnce();
    expect(exitCodes).toEqual([]);

    deferred.resolve();
    await shutdownPromise;

    expect(exitCodes).toEqual([0]);
  });
});
