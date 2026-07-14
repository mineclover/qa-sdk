// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * Dialect 통합 connection factory.
 *
 * 호출자는 dialect + 연결 정보만 전달하고, 결과로 Drizzle DB + close handle을 받는다.
 * 드라이버는 dialect별 dynamic import — 미설치 환경에서도 본 모듈 import는 실패하지 않음.
 */

export type DialectKind = 'sqlite' | 'pg';

export interface SqliteConfig {
  dialect: 'sqlite';
  /** 파일 경로. 미지정 시 :memory: */
  sqlitePath?: string;
}

export interface PgConfig {
  dialect: 'pg';
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  /** search_path에 우선 적용할 schema */
  pgSchema?: string;
  /** 기본 10 */
  pgPoolMax?: number;
}

export type ConnectionConfig = SqliteConfig | PgConfig;

export interface Connection {
  dialect: DialectKind;
  /** Drizzle DB 인스턴스 — 호출자가 schema 적용해 사용 */
  db: unknown;
  /** 연결 정리 */
  close(): Promise<void>;
}

export async function createConnection(cfg: ConnectionConfig): Promise<Connection> {
  if (cfg.dialect === 'sqlite') {
    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const raw = new Database(cfg.sqlitePath ?? ':memory:');
    return {
      dialect: 'sqlite',
      db: drizzle({ client: raw }),
      async close() {
        raw.close();
      },
    };
  }

  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const sql = postgres({
    host: cfg.pgHost,
    port: cfg.pgPort,
    database: cfg.pgDatabase,
    user: cfg.pgUser,
    password: cfg.pgPassword,
    max: cfg.pgPoolMax ?? 10,
    onnotice: () => {},
  });

  if (cfg.pgSchema) {
    await sql`SET search_path TO ${sql(cfg.pgSchema)}, public`;
  }

  return {
    dialect: 'pg',
    db: drizzle({ client: sql }),
    async close() {
      await sql.end();
    },
  };
}

// ============================================================
// Dual connection (write + read replica)
// ============================================================

/**
 * write + read 두 Connection을 묶은 형태.
 *
 * - write: primary 인스턴스 (DDL/DML 모두 가능)
 * - read: replica 인스턴스 (read-only 권장)
 * - close(): 두 connection을 병렬로 닫음
 */
export interface DualConnection {
  dialect: DialectKind;
  write: Connection;
  read: Connection;
  close(): Promise<void>;
}

export type DualConnectionConfig =
  | {
      dialect: 'pg';
      write: Omit<PgConfig, 'dialect'>;
      read: Omit<PgConfig, 'dialect'>;
    }
  | {
      dialect: 'sqlite';
      write: Omit<SqliteConfig, 'dialect'>;
      read: Omit<SqliteConfig, 'dialect'>;
    };

/**
 * write + read 두 Connection을 동일 dialect로 생성한다.
 *
 * - 내부적으로 `createConnection`을 두 번 호출 — 두 인스턴스는 항상 분리되어 있다.
 * - sqlite의 경우에도 별도 인스턴스를 생성한다 (호출자가 같은 파일/`:memory:`를
 *   지정하더라도 connection 자체는 분리됨).
 */
export async function createDualConnection(cfg: DualConnectionConfig): Promise<DualConnection> {
  if (cfg.dialect === 'pg') {
    const write = await createConnection({ dialect: 'pg', ...cfg.write });
    const read = await createConnection({ dialect: 'pg', ...cfg.read });
    return {
      dialect: 'pg',
      write,
      read,
      close: async () => {
        await Promise.all([write.close(), read.close()]);
      },
    };
  }
  const write = await createConnection({ dialect: 'sqlite', ...cfg.write });
  const read = await createConnection({ dialect: 'sqlite', ...cfg.read });
  return {
    dialect: 'sqlite',
    write,
    read,
    close: async () => {
      await Promise.all([write.close(), read.close()]);
    },
  };
}
