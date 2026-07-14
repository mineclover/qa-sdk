// @def.boundary ingest-system
// @def.doc ingest-system

import type { StoredRecord } from '@qa-sdk/core';
import {
  DEFAULT_DEBUG_STORE_MAX_ENTRIES,
  resolveDebugStoreTtlMs,
  type DebugStore,
} from './debug-store.js';

interface DebugStoreEntry {
  record: StoredRecord;
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout>;
}

export interface InMemoryDebugStoreOptions {
  maxEntries?: number;
  ttlMs?: number;
}

export class InMemoryDebugStore implements DebugStore {
  private readonly entries = new Map<string, DebugStoreEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(options: InMemoryDebugStoreOptions = {}) {
    this.defaultTtlMs = normalizePositiveInteger(
      options.ttlMs ?? resolveDebugStoreTtlMs(),
      'ttlMs',
    );
    this.maxEntries = normalizePositiveInteger(
      options.maxEntries ?? DEFAULT_DEBUG_STORE_MAX_ENTRIES,
      'maxEntries',
    );
  }

  async append(record: StoredRecord, ttlMs?: number): Promise<void> {
    this.pruneExpiredEntries();

    const resolvedTtlMs = normalizePositiveInteger(ttlMs ?? this.defaultTtlMs, 'ttlMs');
    const recordSnapshot = structuredClone(record);
    const expiresAt = Date.now() + resolvedTtlMs;

    this.deleteEntry(recordSnapshot.logId);

    const timeout = setTimeout(() => {
      const currentEntry = this.entries.get(recordSnapshot.logId);

      if (!currentEntry || currentEntry.expiresAt !== expiresAt) {
        return;
      }

      this.entries.delete(recordSnapshot.logId);
    }, resolvedTtlMs);
    timeout.unref?.();

    this.entries.set(recordSnapshot.logId, {
      record: recordSnapshot,
      expiresAt,
      timeout,
    });

    this.evictOverflow();
  }

  async getRecentByTrace(traceId: string, limit?: number): Promise<StoredRecord[]> {
    return this.selectRecent((record) => record.traceId === traceId, limit);
  }

  async getRecentBySession(sessionId: string, limit?: number): Promise<StoredRecord[]> {
    return this.selectRecent((record) => record.qaSessionId === sessionId, limit);
  }

  private selectRecent(
    predicate: (record: StoredRecord) => boolean,
    limit?: number,
  ): StoredRecord[] {
    this.pruneExpiredEntries();

    const records = Array.from(this.entries.values())
      .map((entry) => entry.record)
      .filter(predicate);
    const normalizedLimit = normalizeLimit(limit, records.length);

    return records
      .toSorted(compareRecordsByRecency)
      .slice(0, normalizedLimit)
      .map((record) => structuredClone(record));
  }

  private evictOverflow() {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (!oldestKey) {
        return;
      }

      this.deleteEntry(oldestKey);
    }
  }

  private pruneExpiredEntries() {
    const now = Date.now();

    for (const [logId, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.deleteEntry(logId);
      }
    }
  }

  private deleteEntry(logId: string) {
    const entry = this.entries.get(logId);

    if (!entry) {
      return;
    }

    clearTimeout(entry.timeout);
    this.entries.delete(logId);
  }
}

function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) {
    return fallback;
  }

  if (!Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(0, Math.floor(limit));
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function compareRecordsByRecency(left: StoredRecord, right: StoredRecord): number {
  const timestampDelta = right.timestamp.getTime() - left.timestamp.getTime();

  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}
