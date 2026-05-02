// @def.boundary ingest-system
// @def.doc ingest-system

// packages/ingest-server/src/stores/d1-key-observation-store.ts

import { count as countFn, desc, eq, lt, sql, sum, asc, and } from "drizzle-orm";
import type {
  KeyObservationStore,
  KeyObservationEntry,
  KeyObservation,
  KeyObservationSummary,
  PrefixObservationSummary,
} from "@qa-sdk/core";
import { parsePackedAddress } from "@qa-sdk/core/coordinates/address-context-schema";
import { keyObservations, keyObservationPrefixes } from "../db/schema.js";
import { parseJsonColumn, type PayloadSummaryJson } from "../db/json-types.js";
import { EMPTY_PAYLOAD_SUMMARY, mergePayloadSummary } from "./shared/payload-summary.js";
import type { D1Db } from "./d1-db-type.js";

export class D1KeyObservationStore implements KeyObservationStore {
  constructor(private readonly db: D1Db) {}

  async observe(entry: KeyObservationEntry): Promise<void> {
    await this.observeBatch([entry]);
  }

  async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
    for (const entry of entries) {
      // entry에 explicit version/address가 있으면 우선 사용, 없으면 packed_key parse.
      // 포맷 위반은 silent skip (ingest hot path — 이상 데이터로 트래픽 차단 방지).
      const resolved = entry.version !== undefined && entry.address !== undefined
        ? { version: entry.version, address: entry.address }
        : (() => {
            const p = parsePackedAddress(entry.packedKey);
            return p ? { version: p.version, address: p.address } : null;
          })();

      if (!resolved) continue;
      const { version, address } = resolved;

      // 기존 payloadSummary 조회 (PK 변경 — packed_key 대신 (prefix, version, address))
      const [existing] = await this.db
        .select({ payloadSummary: keyObservations.payloadSummary })
        .from(keyObservations)
        .where(and(
          eq(keyObservations.prefixId, entry.prefixId),
          eq(keyObservations.version, version),
          eq(keyObservations.address, address),
        ));

      const prevSummary = existing
        ? parseJsonColumn<PayloadSummaryJson>(existing.payloadSummary, EMPTY_PAYLOAD_SUMMARY)
        : EMPTY_PAYLOAD_SUMMARY;
      const merged = mergePayloadSummary(prevSummary, entry);

      // key_observations upsert — PK = (prefix_id, version, address)
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
          payloadSummary: JSON.stringify(merged),
        })
        .onConflictDoUpdate({
          target: [keyObservations.prefixId, keyObservations.version, keyObservations.address],
          set: {
            count: sql`${keyObservations.count} + 1`,
            lastSeen: entry.timestamp,
            registered: entry.registered,
            payloadSummary: JSON.stringify(merged),
          },
        });

      // key_observation_prefixes upsert — version 차원 포함 (P3)
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
    opts?: { limit?: number; orderBy?: "count" | "last_seen" },
  ): Promise<KeyObservation[]> {
    const orderCol = opts?.orderBy === "last_seen"
      ? desc(keyObservations.lastSeen)
      : desc(keyObservations.count);

    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(eq(keyObservations.prefixId, prefixId))
      .orderBy(orderCol)
      .limit(opts?.limit ?? 100);

    return rows.map(toKeyObservation);
  }

  async summary(): Promise<KeyObservationSummary> {
    // SQL 집계 — 전건 로드 방지
    const [agg] = await this.db
      .select({
        totalKeys: countFn(),
        totalCount: sum(keyObservations.count),
        registeredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = 1 THEN 1 ELSE 0 END)`,
        unregisteredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = 0 THEN 1 ELSE 0 END)`,
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
    const query = this.db.select().from(keyObservationPrefixes);
    const rows = prefixId
      ? await query.where(eq(keyObservationPrefixes.prefixId, prefixId))
      : await query;

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

function toKeyObservation(row: typeof keyObservations.$inferSelect): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    version: row.version,
    address: row.address,
    registered: !!row.registered,
    count: row.count,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    payloadSummary: parseJsonColumn<PayloadSummaryJson>(row.payloadSummary, EMPTY_PAYLOAD_SUMMARY),
  };
}

