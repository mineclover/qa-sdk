// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createDrizzleOutboxPort,
  type OutboxPort,
  type OutboxRecord,
} from "@qa-sdk/sim-domain-slice-kit";
import type { TransactionScope } from "@qa-sdk/sim-domain-slice-kit";
import { buildSchemaHash } from "sim-identifier-grammar";
import { approvalOutboxEvents as sqliteApprovalOutbox } from "../../../sqlite/schema.js";
import { approvalOutboxEvents as pgApprovalOutbox } from "../../../pg/schema.js";
import { withServiceVersion } from "../../../../lib/service-version.js";

export type ExpenseDialect = "sqlite" | "pg";

export interface ExpenseOutboxFactoryOpts {
  readonly dialect: ExpenseDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

// 단계 8(Plan C): build-time schemaHash. spec 02 §4.2.
// EventName 계약: { domain, aggregate, verbPast } — sim-identifier-grammar/event-name.ts SSOT.
const EXPENSE_EVENT_NAME = {
  domain: "approval",
  aggregate: "expense",
  verbPast: "submitted",
} as const;
const EXPENSE_PAYLOAD_SHAPE = {
  id: "string",
  requesterId: "string",
  amount: "number",
  status: "string",
  currentStage: "number",
  totalStages: "number",
  occurredAt: "string",
} as const;
export const EXPENSE_SCHEMA_HASH: string = buildSchemaHash({
  eventName: EXPENSE_EVENT_NAME,
  payloadShape: EXPENSE_PAYLOAD_SHAPE,
});

function withExpenseStamps(record: OutboxRecord): OutboxRecord {
  const stamped =
    typeof record.payload === "object" && record.payload !== null
      ? withServiceVersion({
          ...(record.payload as Record<string, unknown>),
          schemaHash: EXPENSE_SCHEMA_HASH,
        })
      : withServiceVersion({
          value: record.payload,
          schemaHash: EXPENSE_SCHEMA_HASH,
        });
  return { ...record, payload: stamped };
}

function wrap(port: OutboxPort): OutboxPort {
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      return port.append(withExpenseStamps(record), scope);
    },
  };
}

export function createExpenseOutboxPort(
  opts: ExpenseOutboxFactoryOpts,
): OutboxPort {
  if (opts.dialect === "sqlite") {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: sqliteApprovalOutbox,
      }),
    );
  }
  if (opts.dialect === "pg") {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: pgApprovalOutbox,
      }),
    );
  }
  throw new Error(
    `createExpenseOutboxPort: dialect=${(opts as { dialect: string }).dialect}`,
  );
}
