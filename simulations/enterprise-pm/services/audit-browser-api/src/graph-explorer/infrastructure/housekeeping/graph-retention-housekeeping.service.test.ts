// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoggerPort } from "@qa-sdk/sim-domain-slice-kit";
import { GraphStoreQueryPort } from "../../application/ports/graph-store-query.port.js";
import { GraphRetentionHousekeepingService } from "./graph-retention-housekeeping.service.js";

class FakeGraphs extends GraphStoreQueryPort {
  pruneAllSpy = vi.fn(async (keepLatest: number) => ({
    keepLatest,
    graphIds: ["g1"],
    graphCount: 1,
    beforeCount: 2,
    afterCount: 1,
    deletedSnapshotIds: ["s1"],
    graphs: [],
  }));
  async latest() {
    return null;
  }
  async list() {
    return [];
  }
  async getSnapshot() {
    return null;
  }
  async graphIds() {
    return [];
  }
  async diff() {
    return null;
  }
  async prune() {
    return {
      graphId: "g1",
      beforeCount: 0,
      afterCount: 0,
      deletedSnapshotIds: [],
      keptSnapshotIds: [],
    };
  }
  async pruneAll(keepLatest: number) {
    return this.pruneAllSpy(keepLatest);
  }
}

function makeLogger(): LoggerPort {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("GraphRetentionHousekeepingService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs one sweep on boot when enabled", async () => {
    const graphs = new FakeGraphs();
    const svc = new GraphRetentionHousekeepingService(
      graphs,
      { keepLatest: 1, runOnBoot: true },
      makeLogger(),
    );
    await svc.onModuleInit();
    expect(graphs.pruneAllSpy).toHaveBeenCalledWith(1);
    await svc.onModuleDestroy();
  });

  it("runs periodic sweeps when interval is configured", async () => {
    const graphs = new FakeGraphs();
    const svc = new GraphRetentionHousekeepingService(
      graphs,
      { keepLatest: 2, intervalMs: 1000, runOnBoot: false },
      makeLogger(),
    );
    await svc.onModuleInit();
    await vi.advanceTimersByTimeAsync(2100);
    expect(graphs.pruneAllSpy).toHaveBeenCalledTimes(2);
    await svc.onModuleDestroy();
  });

  it("keepLatest 미설정 시 sweep 미실행", async () => {
    const graphs = new FakeGraphs();
    const svc = new GraphRetentionHousekeepingService(
      graphs,
      { runOnBoot: true },
      makeLogger(),
    );
    await svc.onModuleInit();
    expect(graphs.pruneAllSpy).not.toHaveBeenCalled();
    await svc.onModuleDestroy();
  });
});
