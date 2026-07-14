// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createConnection, createDualConnection, parsePgUrl } from 'db-bootstrap';
import { createApprovalRepository } from './factory.js';
import { env } from '../config/env.js';
import type { ApprovalRepository } from './shared/port.js';
import { SIM_APPROVAL_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_APPROVAL_PG_DDL } from './pg/schema.js';

export const APPROVAL_REPOSITORY = Symbol('APPROVAL_REPOSITORY');
export const APPROVAL_DB_INSTANCE = Symbol('APPROVAL_DB_INSTANCE');
/** 단계 8(Plan C): write-only DataSource — INSERT/UPDATE/DELETE 경로. spec 04 §4.3. */
export const WRITE_DATA_SOURCE = Symbol('WRITE_DATA_SOURCE');
/** 단계 8(Plan C): read-replica DataSource — BFF/reporting 슬라이스. spec 04 §4.3. */
export const READ_DATA_SOURCE = Symbol('READ_DATA_SOURCE');

export interface ApprovalDbInstanceHandle {
  dialect: 'sqlite' | 'pg';
  db: BetterSQLite3Database | PostgresJsDatabase;
  /** 단계 8(Plan C): read replica DB. SIM_DB_READ_URL 미설정이면 write와 동일한 인스턴스. */
  readDb?: BetterSQLite3Database | PostgresJsDatabase;
}

async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === 'sqlite') {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === 'function') {
      raw.exec(SIM_APPROVAL_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === 'function') {
    await raw.unsafe(SIM_APPROVAL_PG_DDL);
  }
}

@Module({})
export class ApprovalDbModule {
  static forRoot(): DynamicModule {
    const dbInstanceProvider: Provider = {
      provide: APPROVAL_DB_INSTANCE,
      useFactory: async (): Promise<ApprovalDbInstanceHandle> => {
        // 단계 8(Plan C): SIM_DB_WRITE_URL + SIM_DB_READ_URL 둘 다 설정된 PG 환경이면
        // createDualConnection으로 read replica 인스턴스 분리. spec 04 §4.3.
        const useDual =
          env.QA_DB_DIALECT === 'pg' &&
          typeof env.SIM_DB_WRITE_URL === 'string' &&
          typeof env.SIM_DB_READ_URL === 'string';
        if (useDual) {
          const dual = await createDualConnection({
            dialect: 'pg',
            write: parsePgUrl(env.SIM_DB_WRITE_URL!),
            read: parsePgUrl(env.SIM_DB_READ_URL!),
          });
          // DDL은 write 쪽에만 적용 (replica는 read-only).
          await applyDdl(dual.write);
          return {
            dialect: 'pg',
            db: dual.write.db as PostgresJsDatabase,
            readDb: dual.read.db as PostgresJsDatabase,
          };
        }
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
        return {
          dialect: conn.dialect,
          db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
        };
      },
    };
    // 단계 8(Plan C): write/read DataSource 토큰 — DI 레이어에서 슬라이스 의도 명시.
    // ESLint rule이 BFF/reporting에서 WRITE_DATA_SOURCE import를 차단 (Task 8.6).
    const writeDataSourceProvider: Provider = {
      provide: WRITE_DATA_SOURCE,
      useFactory: (handle: ApprovalDbInstanceHandle) => handle.db,
      inject: [APPROVAL_DB_INSTANCE],
    };
    const readDataSourceProvider: Provider = {
      provide: READ_DATA_SOURCE,
      // SIM_DB_READ_URL 미설정이면 readDb===undefined → write로 fallback.
      // spec 04 §4.3은 read/write 분리를 강제하지만, 단일 컨테이너 dev 환경에서
      // 부팅을 깨지 않기 위해 fail-open한다 (실제 분리는 PG dual 환경에서만).
      useFactory: (handle: ApprovalDbInstanceHandle) => handle.readDb ?? handle.db,
      inject: [APPROVAL_DB_INSTANCE],
    };
    return {
      module: ApprovalDbModule,
      providers: [
        dbInstanceProvider,
        writeDataSourceProvider,
        readDataSourceProvider,
        {
          provide: APPROVAL_REPOSITORY,
          useFactory: async (handle: ApprovalDbInstanceHandle): Promise<ApprovalRepository> => {
            return await createApprovalRepository({
              dialect: handle.dialect,
              db: handle.db,
            });
          },
          inject: [APPROVAL_DB_INSTANCE],
        },
      ],
      exports: [APPROVAL_REPOSITORY, APPROVAL_DB_INSTANCE, WRITE_DATA_SOURCE, READ_DATA_SOURCE],
      global: true,
    };
  }
}
