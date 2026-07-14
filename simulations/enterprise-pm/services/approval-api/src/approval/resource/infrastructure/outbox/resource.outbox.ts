// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  createDrizzleOutboxPort,
  type OutboxPort,
  type OutboxRecord,
} from '@qa-sdk/sim-domain-slice-kit';
import type { TransactionScope } from '@qa-sdk/sim-domain-slice-kit';
import { buildSchemaHash } from 'sim-identifier-grammar';
import { approvalOutboxEvents as sqliteApprovalOutbox } from '../../../sqlite/schema.js';
import { approvalOutboxEvents as pgApprovalOutbox } from '../../../pg/schema.js';
import { withServiceVersion } from '../../../../lib/service-version.js';

export type ResourceDialect = 'sqlite' | 'pg';

export interface ResourceOutboxFactoryOpts {
  readonly dialect: ResourceDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

// 단계 8(Plan C): build-time schemaHash. spec 02 §4.2.
// EventName 계약: { domain, aggregate, verbPast } — sim-identifier-grammar/event-name.ts SSOT.
const RESOURCE_EVENT_NAME = {
  domain: 'approval',
  aggregate: 'resource',
  verbPast: 'submitted',
} as const;
const RESOURCE_PAYLOAD_SHAPE = {
  id: 'string',
  requesterId: 'string',
  resourceType: 'string',
  status: 'string',
  currentStage: 'number',
  totalStages: 'number',
  occurredAt: 'string',
} as const;
export const RESOURCE_SCHEMA_HASH: string = buildSchemaHash({
  eventName: RESOURCE_EVENT_NAME,
  payloadShape: RESOURCE_PAYLOAD_SHAPE,
});

function withResourceStamps(record: OutboxRecord): OutboxRecord {
  const stamped =
    typeof record.payload === 'object' && record.payload !== null
      ? withServiceVersion({
          ...(record.payload as Record<string, unknown>),
          schemaHash: RESOURCE_SCHEMA_HASH,
        })
      : withServiceVersion({
          value: record.payload,
          schemaHash: RESOURCE_SCHEMA_HASH,
        });
  return { ...record, payload: stamped };
}

function wrap(port: OutboxPort): OutboxPort {
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      return port.append(withResourceStamps(record), scope);
    },
  };
}

export function createResourceOutboxPort(opts: ResourceOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === 'sqlite') {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: sqliteApprovalOutbox,
      }),
    );
  }
  if (opts.dialect === 'pg') {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: pgApprovalOutbox,
      }),
    );
  }
  throw new Error(`createResourceOutboxPort: dialect=${(opts as { dialect: string }).dialect}`);
}
