// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createConnection } from 'db-bootstrap';
import { env } from '../config/env.js';
import {
  SIM_NOTIF_NOTIFICATION_SQLITE_DDL,
  SIM_NOTIF_OUTBOX_SQLITE_DDL,
} from './notification/infrastructure/persistence/sqlite.schema.js';
import { SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL } from './subscription/infrastructure/persistence/sqlite.schema.js';
import {
  SIM_NOTIF_NOTIFICATION_PG_DDL,
  SIM_NOTIF_OUTBOX_PG_DDL,
} from './notification/infrastructure/persistence/pg.schema.js';
import { SIM_NOTIF_SUBSCRIPTION_PG_DDL } from './subscription/infrastructure/persistence/pg.schema.js';

/**
 * NestJS DI 토큰 — notification-api 의 모든 슬라이스가 공유하는 Drizzle DB 핸들.
 *
 * - dialect 와 Drizzle 인스턴스를 같이 expose 하여 슬라이스가 자기 어댑터를
 *   factory 로 직접 부착할 수 있게 한다.
 * - Phase 2 슬라이스 모듈 (NotificationSliceModule, SubscriptionSliceModule)
 *   은 모두 본 토큰을 inject 한다.
 */
export const NOTIF_DB_INSTANCE = Symbol('NOTIF_DB_INSTANCE');

/** notification-db.module 가 export 하는 dialect-aware DB 핸들. */
export interface NotifDbInstanceHandle {
  readonly dialect: 'sqlite' | 'pg';
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

/**
 * 서비스 부팅 시 idempotent DDL을 적용한다.
 * 모든 CREATE 문은 IF NOT EXISTS이므로 재기동 안전.
 *
 * 본 서비스가 소유하는 테이블:
 *   - notif_notifications (notification 슬라이스)
 *   - notif_subscriptions (subscription 슬라이스)
 *   - notification_outbox_events (두 슬라이스 공유 outbox)
 *
 * 운영 환경은 drizzle-kit migration이 SSOT이지만, dev/test는 본 auto-apply로 충분.
 */
async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === 'sqlite') {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === 'function') {
      raw.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
      raw.exec(SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL);
      raw.exec(SIM_NOTIF_OUTBOX_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === 'function') {
    await raw.unsafe(SIM_NOTIF_NOTIFICATION_PG_DDL);
    await raw.unsafe(SIM_NOTIF_SUBSCRIPTION_PG_DDL);
    await raw.unsafe(SIM_NOTIF_OUTBOX_PG_DDL);
  }
}

@Module({})
export class NotificationDbModule {
  static forRoot(): DynamicModule {
    /**
     * 단일 connection 캐시 — NOTIF_DB_INSTANCE 가 공유하는 Drizzle 인스턴스를
     * useFactory 들 사이에서 메모이즈한다.
     */
    let connectionPromise: ReturnType<typeof createConnection> | null = null;
    const getConnection = (): ReturnType<typeof createConnection> => {
      if (connectionPromise) return connectionPromise;
      connectionPromise = (async () => {
        const conn = await createConnection(
          env.QA_DB_DIALECT === 'sqlite'
            ? { dialect: 'sqlite', sqlitePath: env.QA_SQLITE_PATH }
            : {
                dialect: 'pg',
                pgHost: env.QA_PG_HOST!,
                pgPort: env.QA_PG_PORT!,
                pgDatabase: env.QA_PG_DATABASE!,
                pgUser: env.QA_PG_USER!,
                pgPassword: env.QA_PG_PASSWORD!,
                pgSchema: env.QA_PG_SCHEMA ?? 'sim',
              },
        );
        await applyDdl(conn);
        return conn;
      })();
      return connectionPromise;
    };

    const dbInstanceProvider: Provider = {
      provide: NOTIF_DB_INSTANCE,
      useFactory: async (): Promise<NotifDbInstanceHandle> => {
        const conn = await getConnection();
        return {
          dialect: conn.dialect,
          db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
        };
      },
    };

    return {
      module: NotificationDbModule,
      providers: [dbInstanceProvider],
      exports: [NOTIF_DB_INSTANCE],
      global: true,
    };
  }
}
