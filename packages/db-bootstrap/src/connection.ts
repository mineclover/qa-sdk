// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * Dialect 통합 connection factory.
 *
 * 호출자는 dialect + 연결 정보만 전달하고, 결과로 Drizzle DB + close handle을 받는다.
 * 드라이버는 dialect별 dynamic import — 미설치 환경에서도 본 모듈 import는 실패하지 않음.
 */

export type DialectKind = "sqlite" | "pg";

export interface SqliteConfig {
  dialect: "sqlite";
  /** 파일 경로. 미지정 시 :memory: */
  sqlitePath?: string;
}

export interface PgConfig {
  dialect: "pg";
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
  if (cfg.dialect === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const raw = new Database(cfg.sqlitePath ?? ":memory:");
    return {
      dialect: "sqlite",
      db: drizzle({ client: raw }),
      async close() { raw.close(); },
    };
  }

  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");

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
    dialect: "pg",
    db: drizzle({ client: sql }),
    async close() { await sql.end(); },
  };
}
