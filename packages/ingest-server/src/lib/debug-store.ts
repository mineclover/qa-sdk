// @def.boundary ingest-system
// @def.doc ingest-system

import type { StoredRecord } from '@qa-sdk/core';

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
