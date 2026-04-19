// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { count as countFn, desc, eq, lt, sql, sum, asc } from "drizzle-orm";
import type {
  KeyObservationStore,
  KeyObservationEntry,
  KeyObservation,
  KeyObservationSummary,
  PrefixObservationSummary,
  PayloadSummary,
} from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { keyObservations, keyObservationPrefixes } from "../../db/schema.js";

const EMPTY_SUMMARY: PayloadSummary = { fieldFrequency: {}, sampleValues: {} };

/** KeyObservationStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleKeyObservationStore implements KeyObservationStore {
  constructor(private readonly db: DbExecutor) {}

  async observe(entry: KeyObservationEntry): Promise<void> {
    await this.observeBatch([entry]);
  }

  async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
    for (const entry of entries) {
      const ts = new Date(entry.timestamp);

      // 기존 payloadSummary 조회 → merge
      const [existing] = await this.db
        .select({ payloadSummary: keyObservations.payloadSummary })
        .from(keyObservations)
        .where(eq(keyObservations.packedKey, entry.packedKey));

      const prev = (existing?.payloadSummary as PayloadSummary) ?? EMPTY_SUMMARY;
      const merged = mergePayloadSummary(prev, entry);

      await this.db
        .insert(keyObservations)
        .values({
          packedKey: entry.packedKey,
          prefixId: entry.prefixId,
          registered: entry.registered,
          count: 1,
          firstSeen: ts,
          lastSeen: ts,
          payloadSummary: merged,
        })
        .onConflictDoUpdate({
          target: keyObservations.packedKey,
          set: {
            count: sql`${keyObservations.count} + 1`,
            lastSeen: ts,
            registered: entry.registered,
            payloadSummary: merged,
          },
        });

      await this.db
        .insert(keyObservationPrefixes)
        .values({
          prefixId: entry.prefixId,
          distinctKeys: 1,
          totalCount: 1,
          firstSeen: ts,
          lastSeen: ts,
        })
        .onConflictDoUpdate({
          target: keyObservationPrefixes.prefixId,
          set: {
            distinctKeys: sql`CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM ${keyObservations}
                WHERE ${keyObservations.packedKey} = ${entry.packedKey}
                AND ${keyObservations.count} > 1
              )
              THEN ${keyObservationPrefixes.distinctKeys} + 1
              ELSE ${keyObservationPrefixes.distinctKeys}
            END`,
            totalCount: sql`${keyObservationPrefixes.totalCount} + 1`,
            lastSeen: ts,
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
    const [agg] = await this.db
      .select({
        totalKeys: countFn(),
        totalCount: sum(keyObservations.count),
        registeredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = true THEN 1 ELSE 0 END)`,
        unregisteredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = false THEN 1 ELSE 0 END)`,
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
      .where(lt(keyObservations.lastSeen, new Date(before)))
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
      distinctKeys: r.distinctKeys,
      totalCount: r.totalCount,
      firstSeen: r.firstSeen.toISOString(),
      lastSeen: r.lastSeen.toISOString(),
    }));
  }
}

function toKeyObservation(row: typeof keyObservations.$inferSelect): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    registered: row.registered,
    count: row.count,
    firstSeen: row.firstSeen.toISOString(),
    lastSeen: row.lastSeen.toISOString(),
    payloadSummary: (row.payloadSummary as PayloadSummary) ?? EMPTY_SUMMARY,
  };
}

/** 기존 summary에 새 관측 데이터를 누적 merge */
function mergePayloadSummary(prev: PayloadSummary, entry: KeyObservationEntry): PayloadSummary {
  const fieldFrequency = { ...prev.fieldFrequency };
  const sampleValues = { ...prev.sampleValues };

  if (entry.payloadFields) {
    for (const field of entry.payloadFields) {
      fieldFrequency[field] = (fieldFrequency[field] ?? 0) + 1;
    }
  }

  // sampleValues는 최신 값으로 갱신 (최대 5 필드)
  if (entry.samplePayload) {
    const keys = Object.keys(entry.samplePayload).slice(0, 5);
    for (const key of keys) {
      sampleValues[key] = entry.samplePayload[key];
    }
  }

  return { fieldFrequency, sampleValues };
}
