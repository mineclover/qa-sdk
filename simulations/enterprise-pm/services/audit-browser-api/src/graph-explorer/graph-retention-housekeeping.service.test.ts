import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphExplorerService } from "./graph-explorer.service.js";
import {
  GraphRetentionHousekeepingService,
} from "./graph-retention-housekeeping.service.js";

describe("GraphRetentionHousekeepingService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs one sweep on boot when enabled", async () => {
    const graphs = {
      pruneAll: vi.fn(async () => ({
        keepLatest: 1,
        graphIds: ["g1"],
        graphCount: 1,
        beforeCount: 2,
        afterCount: 1,
        deletedSnapshotIds: ["s1"],
        graphs: [],
      })),
    } as unknown as GraphExplorerService;

    const svc = new GraphRetentionHousekeepingService(graphs, {
      keepLatest: 1,
      runOnBoot: true,
    });
    await svc.onModuleInit();

    expect(graphs.pruneAll).toHaveBeenCalledWith(1);
    await svc.onModuleDestroy();
  });

  it("runs periodic sweeps when interval is configured", async () => {
    const graphs = {
      pruneAll: vi.fn(async () => ({
        keepLatest: 2,
        graphIds: ["g1"],
        graphCount: 1,
        beforeCount: 3,
        afterCount: 2,
        deletedSnapshotIds: ["s1"],
        graphs: [],
      })),
    } as unknown as GraphExplorerService;

    const svc = new GraphRetentionHousekeepingService(graphs, {
      keepLatest: 2,
      intervalMs: 1000,
      runOnBoot: false,
    });
    await svc.onModuleInit();
    await vi.advanceTimersByTimeAsync(2100);

    expect(graphs.pruneAll).toHaveBeenCalledTimes(2);
    await svc.onModuleDestroy();
  });
});
