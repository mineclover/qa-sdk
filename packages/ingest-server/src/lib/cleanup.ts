// @def.boundary ingest-system
// @def.doc ingest-system

import type { Logger } from 'pino';
import type {
  RuntimeGraph,
  StoredRecord,
  StoredSession,
  StoredTrace,
  StoredVerdict,
} from '@qa-sdk/core';
import {
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryVerdictStore,
  getClient,
} from '@qa-sdk/store';

const DEFAULT_TRACE_RETENTION_DAYS = 30;
const DEFAULT_VERDICT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 1_000;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;
const TEXT_OID = 25;

export interface CleanupOptions {
  traceRetentionDays: number;
  verdictRetentionDays: number;
  batchSize: number;
}

export interface CleanupResult {
  options: CleanupOptions;
  cutoffs: {
    traceCreatedBefore: string;
    verdictComputedBefore: string;
  };
  deleted: {
    eventRecords: number;
    runtimeGraphs: number;
    verdictReports: number;
    traces: number;
    qaSessions: number;
  };
}

export interface CleanupStore {
  listExpiredTraceIds(cutoff: Date, limit: number): Promise<string[]>;
  deleteEventRecordsByTraceIds(traceIds: string[]): Promise<number>;
  deleteRuntimeGraphsByTraceIds(traceIds: string[]): Promise<number>;
  deleteVerdictReportsByTraceIds(traceIds: string[]): Promise<number>;
  deleteTracesByIds(traceIds: string[]): Promise<number>;
  listExpiredVerdictIds(cutoff: Date, limit: number): Promise<string[]>;
  deleteVerdictReportsByIds(verdictIds: string[]): Promise<number>;
  listOrphanSessionIds(limit: number): Promise<string[]>;
  deleteQaSessionsByIds(sessionIds: string[]): Promise<number>;
}

export interface CleanupDeps {
  cleanupStore: CleanupStore;
  logger?: Logger;
  now?: () => Date;
}

export interface InMemoryCleanupStoreDeps {
  graphStore: InMemoryGraphStore;
  recordStore: InMemoryRecordStore;
  sessionStore: InMemorySessionStore;
  traceStore: InMemoryTraceStore;
  verdictStore: InMemoryVerdictStore;
}

export const defaultCleanupOptions: CleanupOptions = {
  traceRetentionDays: DEFAULT_TRACE_RETENTION_DAYS,
  verdictRetentionDays: DEFAULT_VERDICT_RETENTION_DAYS,
  batchSize: DEFAULT_BATCH_SIZE,
};

export async function cleanupExpiredData(
  deps: CleanupDeps,
  options: Partial<CleanupOptions> = {},
): Promise<CleanupResult> {
  const resolvedOptions = resolveCleanupOptions(options);
  const now = deps.now?.() ?? new Date();
  const traceCutoff = subtractDays(now, resolvedOptions.traceRetentionDays);
  const verdictCutoff = subtractDays(now, resolvedOptions.verdictRetentionDays);
  const deleted = {
    eventRecords: 0,
    runtimeGraphs: 0,
    verdictReports: 0,
    traces: 0,
    qaSessions: 0,
  };

  while (true) {
    const verdictIds = await deps.cleanupStore.listExpiredVerdictIds(
      verdictCutoff,
      resolvedOptions.batchSize,
    );
    if (verdictIds.length === 0) {
      break;
    }

    const deletedCount = await deps.cleanupStore.deleteVerdictReportsByIds(verdictIds);
    deleted.verdictReports += deletedCount;
    deps.logger?.info(
      {
        batchSize: verdictIds.length,
        cutoff: verdictCutoff.toISOString(),
        deletedCount,
        retentionDays: resolvedOptions.verdictRetentionDays,
        table: 'verdict_reports',
      },
      'deleted expired cleanup batch',
    );
  }

  while (true) {
    const traceIds = await deps.cleanupStore.listExpiredTraceIds(
      traceCutoff,
      resolvedOptions.batchSize,
    );
    if (traceIds.length === 0) {
      break;
    }

    const eventRecordCount = await deps.cleanupStore.deleteEventRecordsByTraceIds(traceIds);
    const runtimeGraphCount = await deps.cleanupStore.deleteRuntimeGraphsByTraceIds(traceIds);
    const verdictReportCount = await deps.cleanupStore.deleteVerdictReportsByTraceIds(traceIds);
    const traceCount = await deps.cleanupStore.deleteTracesByIds(traceIds);

    deleted.eventRecords += eventRecordCount;
    deleted.runtimeGraphs += runtimeGraphCount;
    deleted.verdictReports += verdictReportCount;
    deleted.traces += traceCount;

    deps.logger?.info(
      {
        batchSize: traceIds.length,
        cutoff: traceCutoff.toISOString(),
        deletedCount: eventRecordCount,
        retentionDays: resolvedOptions.traceRetentionDays,
        table: 'event_records',
      },
      'deleted expired cleanup batch',
    );
    deps.logger?.info(
      {
        batchSize: traceIds.length,
        cutoff: traceCutoff.toISOString(),
        deletedCount: runtimeGraphCount,
        retentionDays: resolvedOptions.traceRetentionDays,
        table: 'runtime_graphs',
      },
      'deleted expired cleanup batch',
    );
    deps.logger?.info(
      {
        batchSize: traceIds.length,
        cutoff: traceCutoff.toISOString(),
        deletedCount: verdictReportCount,
        retentionDays: resolvedOptions.traceRetentionDays,
        table: 'verdict_reports',
      },
      'deleted expired cleanup batch',
    );
    deps.logger?.info(
      {
        batchSize: traceIds.length,
        cutoff: traceCutoff.toISOString(),
        deletedCount: traceCount,
        retentionDays: resolvedOptions.traceRetentionDays,
        table: 'traces',
      },
      'deleted expired cleanup batch',
    );
  }

  deleted.qaSessions += await cleanupOrphanSessions(
    deps.cleanupStore,
    resolvedOptions.batchSize,
    deps.logger,
  );

  deps.logger?.info(
    {
      cutoffs: {
        traceCreatedBefore: traceCutoff.toISOString(),
        verdictComputedBefore: verdictCutoff.toISOString(),
      },
      deleted,
      options: resolvedOptions,
    },
    'expired data cleanup complete',
  );

  return {
    options: resolvedOptions,
    cutoffs: {
      traceCreatedBefore: traceCutoff.toISOString(),
      verdictComputedBefore: verdictCutoff.toISOString(),
    },
    deleted,
  };
}

export function resolveCleanupOptions(options: Partial<CleanupOptions> = {}): CleanupOptions {
  return {
    traceRetentionDays: options.traceRetentionDays ?? defaultCleanupOptions.traceRetentionDays,
    verdictRetentionDays:
      options.verdictRetentionDays ?? defaultCleanupOptions.verdictRetentionDays,
    batchSize: options.batchSize ?? defaultCleanupOptions.batchSize,
  };
}

export function createNoopCleanupStore(): CleanupStore {
  return {
    listExpiredTraceIds: async () => [],
    deleteEventRecordsByTraceIds: async () => 0,
    deleteRuntimeGraphsByTraceIds: async () => 0,
    deleteVerdictReportsByTraceIds: async () => 0,
    deleteTracesByIds: async () => 0,
    listExpiredVerdictIds: async () => [],
    deleteVerdictReportsByIds: async () => 0,
    listOrphanSessionIds: async () => [],
    deleteQaSessionsByIds: async () => 0,
  };
}

export function createDatabaseCleanupStore(databaseUrl: string): CleanupStore {
  const client = getClient(databaseUrl);

  return {
    async listExpiredTraceIds(cutoff, limit) {
      const rows = await client<{ trace_id: string }[]>`
        select trace_id
        from traces
        where created_at < ${cutoff}
        order by created_at asc, trace_id asc
        limit ${limit}
      `;
      return rows.map((row: { trace_id: string }) => row.trace_id);
    },
    async deleteEventRecordsByTraceIds(traceIds) {
      if (traceIds.length === 0) {
        return 0;
      }

      const rows = await client<{ log_id: string }[]>`
        delete from event_records
        where trace_id = any(${client.array(traceIds, TEXT_OID)})
        returning log_id
      `;
      return rows.length;
    },
    async deleteRuntimeGraphsByTraceIds(traceIds) {
      if (traceIds.length === 0) {
        return 0;
      }

      const rows = await client<{ trace_id: string }[]>`
        delete from runtime_graphs
        where trace_id = any(${client.array(traceIds, TEXT_OID)})
        returning trace_id
      `;
      return rows.length;
    },
    async deleteVerdictReportsByTraceIds(traceIds) {
      if (traceIds.length === 0) {
        return 0;
      }

      const rows = await client<{ id: string }[]>`
        delete from verdict_reports
        where trace_id = any(${client.array(traceIds, TEXT_OID)})
        returning id
      `;
      return rows.length;
    },
    async deleteTracesByIds(traceIds) {
      if (traceIds.length === 0) {
        return 0;
      }

      const rows = await client<{ trace_id: string }[]>`
        delete from traces
        where trace_id = any(${client.array(traceIds, TEXT_OID)})
        returning trace_id
      `;
      return rows.length;
    },
    async listExpiredVerdictIds(cutoff, limit) {
      const rows = await client<{ id: string }[]>`
        select id
        from verdict_reports
        where computed_at < ${cutoff}
        order by computed_at asc, id asc
        limit ${limit}
      `;
      return rows.map((row: { id: string }) => row.id);
    },
    async deleteVerdictReportsByIds(verdictIds) {
      if (verdictIds.length === 0) {
        return 0;
      }

      const rows = await client<{ id: string }[]>`
        delete from verdict_reports
        where id = any(${client.array(verdictIds, TEXT_OID)})
        returning id
      `;
      return rows.length;
    },
    async listOrphanSessionIds(limit) {
      const rows = await client<{ session_id: string }[]>`
        select session_id
        from qa_sessions
        where not exists (
          select 1
          from traces
          where traces.session_id = qa_sessions.session_id
        )
        order by started_at asc, session_id asc
        limit ${limit}
      `;
      return rows.map((row: { session_id: string }) => row.session_id);
    },
    async deleteQaSessionsByIds(sessionIds) {
      if (sessionIds.length === 0) {
        return 0;
      }

      const rows = await client<{ session_id: string }[]>`
        delete from qa_sessions
        where session_id = any(${client.array(sessionIds, TEXT_OID)})
        returning session_id
      `;
      return rows.length;
    },
  };
}

export function createInMemoryCleanupStore(deps: InMemoryCleanupStoreDeps): CleanupStore {
  const recordMap = getPrivateMap<string, StoredRecord>(deps.recordStore, 'records');
  const traceMap = getPrivateMap<string, StoredTrace>(deps.traceStore, 'traces');
  const graphMap = getPrivateMap<string, RuntimeGraph>(deps.graphStore, 'graphs');
  const verdictMap = getPrivateMap<string, StoredVerdict>(deps.verdictStore, 'verdicts');
  const verdictIdsByScenarioTrace = getPrivateMap<string, string>(
    deps.verdictStore,
    'verdictIdsByScenarioTrace',
  );
  const sessionMap = getPrivateMap<string, StoredSession>(deps.sessionStore, 'sessions');

  return {
    async listExpiredTraceIds(cutoff, limit) {
      return Array.from(traceMap.values())
        .filter((trace) => trace.createdAt.getTime() < cutoff.getTime())
        .toSorted(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.traceId.localeCompare(right.traceId),
        )
        .slice(0, limit)
        .map((trace) => trace.traceId);
    },
    async deleteEventRecordsByTraceIds(traceIds) {
      return deleteByPredicate(recordMap, (record) => traceIds.includes(record.traceId));
    },
    async deleteRuntimeGraphsByTraceIds(traceIds) {
      let deleted = 0;
      for (const traceId of traceIds) {
        if (graphMap.delete(traceId)) {
          deleted += 1;
        }
      }
      return deleted;
    },
    async deleteVerdictReportsByTraceIds(traceIds) {
      return deleteVerdicts(verdictMap, verdictIdsByScenarioTrace, (verdict) =>
        traceIds.includes(verdict.traceId),
      );
    },
    async deleteTracesByIds(traceIds) {
      let deleted = 0;
      for (const traceId of traceIds) {
        if (traceMap.delete(traceId)) {
          deleted += 1;
        }
      }
      return deleted;
    },
    async listExpiredVerdictIds(cutoff, limit) {
      return Array.from(verdictMap.values())
        .filter((verdict) => verdict.computedAt.getTime() < cutoff.getTime())
        .toSorted(
          (left, right) =>
            left.computedAt.getTime() - right.computedAt.getTime() ||
            left.id.localeCompare(right.id),
        )
        .slice(0, limit)
        .map((verdict) => verdict.id);
    },
    async deleteVerdictReportsByIds(verdictIds) {
      return deleteVerdicts(verdictMap, verdictIdsByScenarioTrace, (verdict) =>
        verdictIds.includes(verdict.id),
      );
    },
    async listOrphanSessionIds(limit) {
      return Array.from(sessionMap.values())
        .filter(
          (session) =>
            !Array.from(traceMap.values()).some((trace) => trace.sessionId === session.sessionId),
        )
        .toSorted(
          (left, right) =>
            left.startedAt.getTime() - right.startedAt.getTime() ||
            left.sessionId.localeCompare(right.sessionId),
        )
        .slice(0, limit)
        .map((session) => session.sessionId);
    },
    async deleteQaSessionsByIds(sessionIds) {
      let deleted = 0;
      for (const sessionId of sessionIds) {
        if (sessionMap.delete(sessionId)) {
          deleted += 1;
        }
      }
      return deleted;
    },
  };
}

async function cleanupOrphanSessions(
  cleanupStore: CleanupStore,
  batchSize: number,
  logger?: Logger,
): Promise<number> {
  let totalDeleted = 0;

  while (true) {
    const sessionIds = await cleanupStore.listOrphanSessionIds(batchSize);
    if (sessionIds.length === 0) {
      return totalDeleted;
    }

    const deletedCount = await cleanupStore.deleteQaSessionsByIds(sessionIds);
    totalDeleted += deletedCount;
    logger?.info(
      {
        batchSize: sessionIds.length,
        deletedCount,
        table: 'qa_sessions',
      },
      'deleted expired cleanup batch',
    );
  }
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

function getPrivateMap<TKey, TValue>(target: unknown, fieldName: string): Map<TKey, TValue> {
  return (target as Record<string, Map<TKey, TValue>>)[fieldName];
}

function deleteByPredicate<TKey, TValue>(
  map: Map<TKey, TValue>,
  predicate: (value: TValue) => boolean,
): number {
  let deleted = 0;

  for (const [key, value] of map.entries()) {
    if (!predicate(value)) {
      continue;
    }

    map.delete(key);
    deleted += 1;
  }

  return deleted;
}

function deleteVerdicts(
  verdictMap: Map<string, StoredVerdict>,
  verdictIdsByScenarioTrace: Map<string, string>,
  predicate: (verdict: StoredVerdict) => boolean,
): number {
  let deleted = 0;

  for (const [id, verdict] of verdictMap.entries()) {
    if (!predicate(verdict)) {
      continue;
    }

    verdictMap.delete(id);
    verdictIdsByScenarioTrace.delete(toScenarioTraceKey(verdict.scenarioId, verdict.traceId));
    deleted += 1;
  }

  return deleted;
}

function toScenarioTraceKey(scenarioId: string, traceId: string): string {
  return `${scenarioId}::${traceId}`;
}
