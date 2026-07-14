// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createConnection } from 'db-bootstrap';
import { env } from '../config/env.js';
import { SIM_AUTH_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_AUTH_PG_DDL } from './pg/schema.js';
import {
  SIM_AUTH_OUTBOX_SQLITE_DDL,
  SIM_AUTH_OUTBOX_PG_DDL,
} from './_outbox/auth-outbox.schema.js';

/**
 * NestJS DI 토큰 — auth 슬라이스가 공유하는 Drizzle DB 핸들.
 *
 * - dialect 와 Drizzle 인스턴스를 같이 expose 하여 슬라이스가 자기 어댑터를
 *   factory 로 직접 부착할 수 있게 한다.
 * - Phase 2 슬라이스 모듈은 모두 본 토큰을 inject 한다.
 */
export const AUTH_DB_INSTANCE = Symbol('AUTH_DB_INSTANCE');

/** auth-db.module 가 export 하는 dialect-aware DB 핸들. */
export interface AuthDbInstanceHandle {
  readonly dialect: 'sqlite' | 'pg';
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

/**
 * 서비스 부팅 시 idempotent DDL을 적용한다.
 * 모든 CREATE 문은 IF NOT EXISTS이므로 재기동 안전.
 * 운영 환경은 drizzle-kit migration이 SSOT이지만, dev/test는 본 auto-apply로 충분.
 */
async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === 'sqlite') {
    // BetterSQLite3Database.$client.exec로 raw 실행
    const db = conn.db as BetterSQLite3Database;
    // drizzle 인스턴스에서 내부 raw client 접근
    const raw = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === 'function') {
      raw.exec(SIM_AUTH_SQLITE_DDL);
      // 6 슬라이스가 공유하는 단일 outbox 테이블 — auth-db 부팅에서 함께 적용.
      raw.exec(SIM_AUTH_OUTBOX_SQLITE_DDL);
    }
    return;
  }
  // PG: drizzle PostgresJsDatabase → sql unsafe
  const db = conn.db as PostgresJsDatabase;
  const raw = (db as unknown as { $client: (q: string) => Promise<unknown> })
    .$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === 'function') {
    await raw.unsafe(SIM_AUTH_PG_DDL);
    await raw.unsafe(SIM_AUTH_OUTBOX_PG_DDL);
  }
}

@Module({})
export class AuthDbModule {
  static forRoot(): DynamicModule {
    /**
     * 단일 connection 캐시 — AUTH_DB_INSTANCE provider useFactory 가 같은
     * Drizzle 인스턴스를 재사용하도록 promise 를 메모이즈한다.
     * (NestJS provider 인스턴스는 모듈 단위로 재사용되므로 module 클로저에
     * 보관해도 안전.)
     */
    let connectionPromise: ReturnType<typeof createConnection> | null = null;
    const getConnection = (): ReturnType<typeof createConnection> => {
      if (connectionPromise) return connectionPromise;
      connectionPromise = (async () => {
        const conn = await createConnection(
          env.QA_DB_DIALECT === 'sqlite'
            ? {
                dialect: 'sqlite',
                sqlitePath: env.QA_SQLITE_PATH,
              }
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

    return {
      module: AuthDbModule,
      providers: [
        {
          provide: AUTH_DB_INSTANCE,
          useFactory: async (): Promise<AuthDbInstanceHandle> => {
            const conn = await getConnection();
            return {
              dialect: conn.dialect,
              db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
            };
          },
        },
      ],
      exports: [AUTH_DB_INSTANCE],
      global: true,
    };
  }
}
