// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * PgKeyObservationStore — KeyObservationStore의 PostgreSQL 영속 구현 (Plan 07b).
 *
 * D1 어댑터(`d1-key-observation-store.ts`)와 동일 비즈니스 로직.
 * dialect 차이:
 *   - boolean: PG native (D1은 INTEGER 0/1)
 *   - jsonb payload_summary (D1은 TEXT JSON)
 *   - registered SQL 비교: PG `= TRUE` (D1 `= 1`)
 */

import { and, asc, count as countFn, desc, eq, lt, sql, sum } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  KeyObservation,
  KeyObservationEntry,
  KeyObservationStore,
  KeyObservationSummary,
  PayloadSummary,
  PrefixObservationSummary,
} from '@qa-sdk/core';
import { parsePackedAddress } from '@qa-sdk/core/coordinates/address-context-schema';

import { EMPTY_PAYLOAD_SUMMARY, mergePayloadSummary } from '../shared/payload-summary.js';
import { keyObservationPrefixes, keyObservations, type KeyObservationPgRow } from './schema.js';

export class PgKeyObservationStore implements KeyObservationStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async observe(entry: KeyObservationEntry): Promise<void> {
    await this.observeBatch([entry]);
  }

  async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
    for (const entry of entries) {
      const resolved =
        entry.version !== undefined && entry.address !== undefined
          ? { version: entry.version, address: entry.address }
          : (() => {
              const p = parsePackedAddress(entry.packedKey);
              return p ? { version: p.version, address: p.address } : null;
            })();

      if (!resolved) continue;
      const { version, address } = resolved;

      const [existing] = await this.db
        .select({ payloadSummary: keyObservations.payloadSummary })
        .from(keyObservations)
        .where(
          and(
            eq(keyObservations.prefixId, entry.prefixId),
            eq(keyObservations.version, version),
            eq(keyObservations.address, address),
          ),
        );

      const prevSummary =
        (existing?.payloadSummary as PayloadSummary | undefined) ?? EMPTY_PAYLOAD_SUMMARY;
      const merged = mergePayloadSummary(prevSummary, entry);

      await this.db
        .insert(keyObservations)
        .values({
          prefixId: entry.prefixId,
          version,
          address,
          packedKey: entry.packedKey,
          registered: entry.registered,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          payloadSummary: merged,
        })
        .onConflictDoUpdate({
          target: [keyObservations.prefixId, keyObservations.version, keyObservations.address],
          set: {
            count: sql`${keyObservations.count} + 1`,
            lastSeen: entry.timestamp,
            registered: entry.registered,
            payloadSummary: merged,
          },
        });

      // version별 집계 — 신규 row일 때만 distinctKeys 증가.
      // PG에서는 ON CONFLICT 시점에 EXCLUDED.count로 신규 여부 판단:
      //   - INSERT 신규: EXCLUDED.count == 1 → distinctKeys + 1
      //   - 기존 row UPDATE: prefixes upsert는 신규 미발생 (count 단순 +1)
      // 단, key_observation_prefixes upsert 자체가 신규/기존 흐름을 모두 처리해야 하므로
      // DISTINCT 카운팅은 sub-select로 안전하게 계산.
      await this.db
        .insert(keyObservationPrefixes)
        .values({
          prefixId: entry.prefixId,
          version,
          distinctKeys: 1,
          totalCount: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
        })
        .onConflictDoUpdate({
          target: [keyObservationPrefixes.prefixId, keyObservationPrefixes.version],
          set: {
            distinctKeys: sql`CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM ${keyObservations}
                WHERE ${keyObservations.prefixId} = ${entry.prefixId}
                  AND ${keyObservations.version} = ${version}
                  AND ${keyObservations.address} = ${address}
                  AND ${keyObservations.count} > 1
              )
              THEN ${keyObservationPrefixes.distinctKeys} + 1
              ELSE ${keyObservationPrefixes.distinctKeys}
            END`,
            totalCount: sql`${keyObservationPrefixes.totalCount} + 1`,
            lastSeen: entry.timestamp,
          },
        });
    }
  }

  async findByPrefix(
    prefixId: string,
    opts?: { limit?: number; orderBy?: 'count' | 'last_seen' },
  ): Promise<KeyObservation[]> {
    const orderCol =
      opts?.orderBy === 'last_seen' ? desc(keyObservations.lastSeen) : desc(keyObservations.count);

    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(eq(keyObservations.prefixId, prefixId))
      .orderBy(orderCol)
      .limit(opts?.limit ?? 100);

    return rows.map(toKeyObservation);
  }

  async summary(): Promise<KeyObservationSummary> {
    const [agg] = await this.db
      .select({
        totalKeys: countFn(),
        totalCount: sum(keyObservations.count),
        registeredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = TRUE THEN 1 ELSE 0 END)`,
        unregisteredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = FALSE THEN 1 ELSE 0 END)`,
      })
      .from(keyObservations);

    const breakdownRows = await this.db
      .select({
        prefixId: keyObservations.prefixId,
        total: sum(keyObservations.count),
      })
      .from(keyObservations)
      .groupBy(keyObservations.prefixId);

    const prefixBreakdown: Record<string, number> = {};
    for (const row of breakdownRows) {
      prefixBreakdown[row.prefixId] = Number(row.total ?? 0);
    }

    return {
      totalKeys: Number(agg?.totalKeys ?? 0),
      totalCount: Number(agg?.totalCount ?? 0),
      registeredKeys: Number(agg?.registeredKeys ?? 0),
      unregisteredKeys: Number(agg?.unregisteredKeys ?? 0),
      prefixBreakdown,
    };
  }

  async findStale(before: string, limit = 500): Promise<KeyObservation[]> {
    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(lt(keyObservations.lastSeen, before))
      .orderBy(asc(keyObservations.lastSeen))
      .limit(limit);

    return rows.map(toKeyObservation);
  }

  async findUnregistered(opts?: { limit?: number }): Promise<KeyObservation[]> {
    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(eq(keyObservations.registered, false))
      .orderBy(desc(keyObservations.count))
      .limit(opts?.limit ?? 100);

    return rows.map(toKeyObservation);
  }

  async prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]> {
    const rows = prefixId
      ? await this.db
          .select()
          .from(keyObservationPrefixes)
          .where(eq(keyObservationPrefixes.prefixId, prefixId))
      : await this.db.select().from(keyObservationPrefixes);

    return rows.map((r) => ({
      prefixId: r.prefixId,
      version: r.version,
      distinctKeys: r.distinctKeys,
      totalCount: r.totalCount,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
    }));
  }
}

function toKeyObservation(row: KeyObservationPgRow): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    version: row.version,
    address: row.address,
    registered: row.registered,
    count: row.count,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    payloadSummary: (row.payloadSummary as PayloadSummary) ?? EMPTY_PAYLOAD_SUMMARY,
  };
}
