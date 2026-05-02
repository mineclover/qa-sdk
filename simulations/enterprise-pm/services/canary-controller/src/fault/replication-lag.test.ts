// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach } from "vitest";
import {
  ReplicationLagFault,
  type PgQueryRunner,
} from "./replication-lag.js";

class FakePg implements PgQueryRunner {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  async query(sql: string, params: unknown[]) {
    this.calls.push({ sql, params });
  }
}

describe("ReplicationLagFault (시나리오 #14)", () => {
  let primary: FakePg, replica: FakePg, f: ReplicationLagFault;
  beforeEach(() => {
    primary = new FakePg();
    replica = new FakePg();
    f = new ReplicationLagFault(primary, replica);
  });

  it("enable issues slot_advance on primary + pg_sleep on replica using grammar #13 slot", async () => {
    await f.enable({ ms: 3000 });
    expect(primary.calls[0].sql).toMatch(/pg_replication_slot_advance/);
    expect(primary.calls[0].params).toEqual(["sim_read_replica_slot"]);
    expect(replica.calls[0].sql).toMatch(/pg_sleep/);
    expect(replica.calls[0].params).toEqual([3]); // 3000ms / 1000
  });
  it("disable is no-op (사이클 회복) + reset advances slot to current_wal_lsn", async () => {
    await f.enable({ ms: 3000 });
    primary.calls = [];
    replica.calls = [];
    await f.disable();
    expect(primary.calls).toHaveLength(0);
    expect(replica.calls).toHaveLength(0);
    await f.reset();
    expect(
      primary.calls.some(
        (c) =>
          /pg_replication_slot_advance/.test(c.sql) &&
          /pg_current_wal_lsn/.test(c.sql),
      ),
    ).toBe(true);
  });
  it("rejects ms < 0 or non-integer", async () => {
    await expect(f.enable({ ms: -1 })).rejects.toThrow();
    await expect(f.enable({ ms: 1.5 })).rejects.toThrow();
  });
});
