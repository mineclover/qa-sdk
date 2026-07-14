// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 #14 (spec 04 §4.4 + spec 05 §3) — lag-injector 3000ms 주입으로 controller
// replicationHealth가 WARN으로 떨어지고 BFF read 라우팅이 일시 primary fallback하는 흐름.
// 구현은 spec 04 §4.4의 두 SQL을 그대로 사용 — primary pg_replication_slot_advance +
// standby pg_sleep. slot명은 Plan A Task 2.14의 buildReplicationSlot grammar #13으로
// 빌드(직접 문자열 입력 금지). lag-injector는 idempotent하지 않으므로 reset 필수.

import { z } from 'zod';
import { buildReplicationSlot } from 'sim-identifier-grammar';
import type { Fault } from './types.js';

export interface PgQueryRunner {
  query(sql: string, params: unknown[]): Promise<void>;
}

const ParamsSchema = z.object({ ms: z.number().int().nonnegative() });

export class ReplicationLagFault implements Fault {
  // Plan A Task 2.14 grammar #13 — 직접 문자열 입력 금지.
  private readonly slotName = buildReplicationSlot({ purpose: 'read_replica' });
  constructor(
    private readonly primary: PgQueryRunner,
    private readonly replica: PgQueryRunner,
  ) {}

  async enable(params: unknown) {
    const { ms } = ParamsSchema.parse(params);
    // (a) primary — slot advance 지연
    await this.primary.query(`SELECT pg_replication_slot_advance($1, pg_current_wal_lsn())`, [
      this.slotName,
    ]);
    // (b) standby — recovery 임시 sleep
    await this.replica.query(`SELECT pg_sleep($1)`, [ms / 1000]);
  }
  async disable() {
    /* no-op: 사이클 회복으로 자연 해소 */
  }
  async reset() {
    // spec 04 §4.4: 시나리오 종료 시 slot을 current_wal_lsn까지 재진행해 lag 0 보장.
    await this.primary.query(`SELECT pg_replication_slot_advance($1, pg_current_wal_lsn())`, [
      this.slotName,
    ]);
  }
}
