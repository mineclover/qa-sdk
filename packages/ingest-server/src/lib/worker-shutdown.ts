// @def.boundary ingest-system
// @def.doc ingest-system

import type { Logger } from 'pino';

type ExitFn = (code: number) => never | void;
type SignalHandler = () => void;
type SignalRegistrar = {
  on: (signal: NodeJS.Signals, listener: SignalHandler) => unknown;
};

export interface WorkerShutdownDeps {
  close: () => Promise<void>;
  exit?: ExitFn;
  logger: Logger;
  process?: SignalRegistrar;
}

export function installWorkerShutdown(deps: WorkerShutdownDeps) {
  const exit = deps.exit ?? process.exit;
  const signalRegistrar = deps.process ?? process;
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (signal: NodeJS.Signals | string) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = performShutdown(signal);
    return shutdownPromise;
  };

  const performShutdown = async (signal: NodeJS.Signals | string) => {
    deps.logger.info({ signal }, 'worker shutdown requested');

    try {
      await deps.close();
      deps.logger.info('worker shutdown complete');
      exit(0);
    } catch (error) {
      deps.logger.error({ err: error }, 'error during worker shutdown');
      exit(1);
    }
  };

  signalRegistrar.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  signalRegistrar.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  return { shutdown };
}
