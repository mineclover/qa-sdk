// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.4 — outbox admin endpoint NestJS module wiring.
//
// providers:
//   - WorkerConnectionPool: dispatch worker 마다 별도 PG connection 발급 + onModuleDestroy 시 일괄 sql.end().
//   - OUTBOX_ADMIN_REPO: Drizzle db.transaction(...) → tx.insert(approvalOutboxEvents).values(rows).returning({id}).
//   - OUTBOX_DISPATCHER_FACTORY: Plan B Stage 5 createOutboxDispatcher 를 wrap, claimed.push(evt.id) 누적.
//
// PG 연결정보는 process.env (SIM_APPROVAL_PG_URL) — 본 module 은 통합 환경에서만 활성화된다.
// SIM_APPROVAL_PG_URL 미설정 시 module 자체 import 는 가능하지만 첫 실제 호출 시 throw.

import {
  Module,
  type OnModuleDestroy,
  Inject,
  Injectable,
} from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Sql } from "postgres";
import { OutboxAdminController } from "./outbox-admin.controller.js";
import { OutboxAdminInsertService } from "./outbox-admin-insert.service.js";
import {
  OutboxAdminDispatchService,
  type OutboxAdminDispatcher,
  type OutboxDispatcherFactory,
} from "./outbox-admin-dispatch.service.js";
import {
  OUTBOX_ADMIN_REPO,
  OUTBOX_DISPATCHER_FACTORY,
  type OutboxAdminRepo,
  type OutboxAdminRepoTx,
} from "./outbox-admin.tokens.js";
import { approvalOutboxEvents } from "../approval/pg/schema.js";
import { createOutboxDispatcher } from "../approval/shared/outbox/outbox-dispatcher.js";

function resolvePgUrl(): string {
  const url = process.env.SIM_APPROVAL_PG_URL;
  if (!url || url.length === 0) {
    throw new Error(
      "SIM_APPROVAL_PG_URL is not set — OutboxAdminModule requires PG connection",
    );
  }
  return url;
}

// Worker 마다 별도 connection — postgres.js 의 sql.begin 이 transaction-scoped 이므로
// 여러 worker 가 동시에 SELECT … FOR UPDATE SKIP LOCKED 를 잡으려면 connection 도 분리되어야 한다.
@Injectable()
export class WorkerConnectionPool implements OnModuleDestroy {
  private readonly conns: Sql[] = [];

  open(): Sql {
    const sql = postgres(resolvePgUrl(), {
      max: 1,
      onnotice: () => {},
    });
    this.conns.push(sql);
    return sql;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.conns.map((c) => c.end({ timeout: 5 })));
  }
}

// admin/insert 전용 lazy 단일 connection — onModuleDestroy 시 정리.
@Injectable()
export class InsertConnectionHolder implements OnModuleDestroy {
  private sql: Sql | null = null;

  get(): Sql {
    if (this.sql === null) {
      this.sql = postgres(resolvePgUrl(), { onnotice: () => {} });
    }
    return this.sql;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sql !== null) {
      await this.sql.end({ timeout: 5 });
      this.sql = null;
    }
  }
}

@Module({
  controllers: [OutboxAdminController],
  providers: [
    WorkerConnectionPool,
    InsertConnectionHolder,
    OutboxAdminInsertService,
    OutboxAdminDispatchService,
    {
      provide: OUTBOX_ADMIN_REPO,
      inject: [InsertConnectionHolder],
      useFactory: (holder: InsertConnectionHolder): OutboxAdminRepo => {
        return {
          transaction: async <T>(
            cb: (tx: OutboxAdminRepoTx) => Promise<T>,
          ): Promise<T> => {
            const sql = holder.get();
            // postgres.js 는 sql.begin 안에서 발급된 콜백을 transaction 으로 묶는다.
            return (await sql.begin(async (txSql) => {
              // postgres.js TransactionSql 은 Sql 의 sub-type 이지만 drizzle 의 client 시그니처가
              // 정확히 matching 되지 않는다 — 런타임 호환은 보장되므로 unknown cast 로 좁힌다.
              const txDb = drizzle({ client: txSql as unknown as Sql });
              const txRepo: OutboxAdminRepoTx = {
                async insertMany(rows) {
                  if (rows.length === 0) return [];
                  const r = await txDb
                    .insert(approvalOutboxEvents)
                    .values(rows as never)
                    .returning({ id: approvalOutboxEvents.id });
                  return r.map((x) => x.id);
                },
              };
              return cb(txRepo);
            })) as T;
          },
        };
      },
    },
    {
      provide: OUTBOX_DISPATCHER_FACTORY,
      inject: [WorkerConnectionPool],
      useFactory: (pool: WorkerConnectionPool): OutboxDispatcherFactory => {
        return (consumerName: string): OutboxAdminDispatcher => {
          const sql = pool.open();
          const db = drizzle({ client: sql });
          const claimed: string[] = [];
          const inner = createOutboxDispatcher({
            db,
            sql,
            consumerName,
            consume: async (evt) => {
              claimed.push(evt.id);
            },
            batchSize: 10,
            maxRetries: 5,
          });
          return {
            consumerName,
            claimed,
            tick: () => inner.tick(),
          };
        };
      },
    },
  ],
  exports: [OutboxAdminInsertService, OutboxAdminDispatchService],
})
export class OutboxAdminModule {}
