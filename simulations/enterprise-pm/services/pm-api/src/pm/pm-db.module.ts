// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createConnection } from 'db-bootstrap';
import { createPmRepository } from './factory.js';
import { env } from '../config/env.js';
import type { PmRepository } from './shared/port.js';
import { SIM_PM_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_PM_PG_DDL } from './pg/schema.js';
import { SIM_PM_ASSIGNMENT_SQLITE_DDL } from './assignment/infrastructure/persistence/sqlite.schema.js';
import { SIM_PM_ASSIGNMENT_PG_DDL } from './assignment/infrastructure/persistence/pg.schema.js';

export const PM_REPOSITORY = Symbol('PM_REPOSITORY');
export const PM_DB_INSTANCE = Symbol('PM_DB_INSTANCE');
export const PM_DB_DIALECT = Symbol('PM_DB_DIALECT');

export interface PmDbInstanceHandle {
  dialect: 'sqlite' | 'pg';
  db: BetterSQLite3Database | PostgresJsDatabase;
}

/**
 * pm-api 의 모든 슬라이스가 공유하는 outbox 테이블 (`pm_outbox_events`) 은
 * SIM_PM_*_DDL 이 정의한다 (다른 sim-* 서비스의 service-shared outbox 패턴과 일치).
 *
 * 슬라이스 본 테이블 중:
 *   - projects / tasks / project_members → SIM_PM_*_DDL 이 정의 (기존 호환).
 *   - pm_assignments → assignment 슬라이스 전용 SIM_PM_ASSIGNMENT_*_DDL 이 정의.
 */
async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === 'sqlite') {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === 'function') {
      raw.exec(SIM_PM_SQLITE_DDL);
      raw.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === 'function') {
    await raw.unsafe(SIM_PM_PG_DDL);
    await raw.unsafe(SIM_PM_ASSIGNMENT_PG_DDL);
  }
}

@Module({})
export class PmDbModule {
  static forRoot(): DynamicModule {
    // PM_DB_INSTANCE: 단일 Connection 재사용 — AccessCheckerModule 과 db 공유
    const dbInstanceProvider: Provider = {
      provide: PM_DB_INSTANCE,
      useFactory: async (): Promise<PmDbInstanceHandle> => {
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
        return {
          dialect: conn.dialect,
          db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
        };
      },
    };
    return {
      module: PmDbModule,
      providers: [
        dbInstanceProvider,
        {
          provide: PM_REPOSITORY,
          useFactory: async (handle: PmDbInstanceHandle): Promise<PmRepository> => {
            return await createPmRepository({
              dialect: handle.dialect,
              db: handle.db,
            });
          },
          inject: [PM_DB_INSTANCE],
        },
      ],
      exports: [PM_REPOSITORY, PM_DB_INSTANCE],
      global: true,
    };
  }
}
