// packages/ingest-server/src/stores/d1-key-observation-store.ts

import { desc, eq, lt, sql, asc } from "drizzle-orm";
import type {
  KeyObservationStore,
  KeyObservationEntry,
  KeyObservation,
  KeyObservationSummary,
  PrefixObservationSummary,
} from "@qa-sdk/core";
import { keyObservations, keyObservationPrefixes } from "../db/schema.js";
import { parseJsonColumn, type PayloadSummaryJson, EMPTY_PAYLOAD_SUMMARY } from "../db/json-types.js";
import type { D1Db } from "./d1-db-type.js";

export class D1KeyObservationStore implements KeyObservationStore {
  constructor(private readonly db: D1Db) {}

  async observe(entry: KeyObservationEntry): Promise<void> {
    await this.observeBatch([entry]);
  }

  async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
    for (const entry of entries) {
      const summary = buildPayloadSummary(entry);

      // key_observations upsert
      await this.db
        .insert(keyObservations)
        .values({
          packedKey: entry.packedKey,
          prefixId: entry.prefixId,
          registered: entry.registered,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          payloadSummary: JSON.stringify(summary),
        })
        .onConflictDoUpdate({
          target: keyObservations.packedKey,
          set: {
            count: sql`${keyObservations.count} + 1`,
            lastSeen: entry.timestamp,
            registered: entry.registered,
            payloadSummary: JSON.stringify(summary),
          },
        });

      // key_observation_prefixes upsert
      await this.db
        .insert(keyObservationPrefixes)
        .values({
          prefixId: entry.prefixId,
          distinctKeys: 1,
          totalCount: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
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
    const rows = await this.db.select().from(keyObservations);

    let totalKeys = 0;
    let totalCount = 0;
    let registeredKeys = 0;
    let unregisteredKeys = 0;
    const prefixBreakdown: Record<string, number> = {};

    for (const row of rows) {
      totalKeys++;
      totalCount += row.count;
      if (row.registered) registeredKeys++;
      else unregisteredKeys++;
      prefixBreakdown[row.prefixId] = (prefixBreakdown[row.prefixId] ?? 0) + row.count;
    }

    return { totalKeys, totalCount, registeredKeys, unregisteredKeys, prefixBreakdown };
  }

  async findStale(before: string): Promise<KeyObservation[]> {
    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(lt(keyObservations.lastSeen, before))
      .orderBy(asc(keyObservations.lastSeen));

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
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
    }));
  }
}

function toKeyObservation(row: typeof keyObservations.$inferSelect): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    registered: !!row.registered,
    count: row.count,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    payloadSummary: parseJsonColumn<PayloadSummaryJson>(row.payloadSummary, EMPTY_PAYLOAD_SUMMARY),
  };
}

function buildPayloadSummary(entry: KeyObservationEntry): PayloadSummaryJson {
  const fieldFrequency: Record<string, number> = {};
  const sampleValues: Record<string, unknown> = {};

  if (entry.payloadFields) {
    for (const field of entry.payloadFields) {
      fieldFrequency[field] = 1;
    }
  }

  if (entry.samplePayload) {
    const keys = Object.keys(entry.samplePayload).slice(0, 5);
    for (const key of keys) {
      sampleValues[key] = entry.samplePayload[key];
    }
  }

  return { fieldFrequency, sampleValues };
}
