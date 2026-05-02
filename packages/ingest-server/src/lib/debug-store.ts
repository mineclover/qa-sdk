// @def.boundary ingest-system
// @def.doc ingest-system

import type { StoredRecord } from "@qa-sdk/core";

export const DEFAULT_DEBUG_STORE_TTL_MS = 5 * 60 * 1_000;
export const DEFAULT_DEBUG_STORE_MAX_ENTRIES = 10_000;

export interface DebugStore {
  append(record: StoredRecord, ttlMs?: number): Promise<void>;
  getRecentByTrace(traceId: string, limit?: number): Promise<StoredRecord[]>;
  getRecentBySession(sessionId: string, limit?: number): Promise<StoredRecord[]>;
}

const noopDebugStore: DebugStore = {
  async append() {},
  async getRecentByTrace() {
    return [];
  },
  async getRecentBySession() {
    return [];
  },
};

export function createNoopDebugStore(): DebugStore {
  return noopDebugStore;
}

export function resolveDebugStoreTtlMs(
  source: NodeJS.ProcessEnv = process.env,
): number {
  const rawValue = source.DEBUG_STORE_TTL_MS;

  if (rawValue === undefined || rawValue.trim().length === 0) {
    return DEFAULT_DEBUG_STORE_TTL_MS;
  }

  const ttlMs = Number(rawValue);

  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("DEBUG_STORE_TTL_MS must be a positive integer");
  }

  return ttlMs;
}
