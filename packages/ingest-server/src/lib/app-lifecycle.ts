type DrainWaiter = () => void;

export interface AppLifecycle {
  beginShutdown(): boolean;
  getInFlightIngestRequestCount(): number;
  isShuttingDown(): boolean;
  tryStartIngestRequest(): (() => void) | null;
  waitForInFlightIngestRequests(): Promise<void>;
}

export function createAppLifecycle(): AppLifecycle {
  let shuttingDown = false;
  let inFlightIngestRequests = 0;
  const drainWaiters = new Set<DrainWaiter>();

  const resolveDrainWaiters = () => {
    if (inFlightIngestRequests !== 0) {
      return;
    }

    for (const waiter of Array.from(drainWaiters)) {
      waiter();
    }

    drainWaiters.clear();
  };

  return {
    beginShutdown() {
      if (shuttingDown) {
        return false;
      }

      shuttingDown = true;
      resolveDrainWaiters();
      return true;
    },
    getInFlightIngestRequestCount() {
      return inFlightIngestRequests;
    },
    isShuttingDown() {
      return shuttingDown;
    },
    tryStartIngestRequest() {
      if (shuttingDown) {
        return null;
      }

      inFlightIngestRequests += 1;
      let finished = false;

      return () => {
        if (finished) {
          return;
        }

        finished = true;
        inFlightIngestRequests -= 1;
        resolveDrainWaiters();
      };
    },
    waitForInFlightIngestRequests() {
      if (inFlightIngestRequests === 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        drainWaiters.add(resolve);
      });
    },
  };
}
