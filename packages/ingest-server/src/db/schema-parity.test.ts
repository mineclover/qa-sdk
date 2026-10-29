// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * SQLite DDL 3벌 정합 — drizzle schema(정본) ↔ drizzle migration(server 런타임) ↔ D1 DDL(CF Worker).
 *
 * 테이블·컬럼(type, NOT NULL, PK)·명시 인덱스(이름, unique, 컬럼)가 모두 같아야 한다.
 * schema.ts를 바꾸고 migration 또는 d1-schema.sql.ts 동기화를 빠뜨리면 실패한다.
 */

import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { is } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { NodeSqliteDriver } from 'index-meta-store';
import { describe, expect, it } from 'vitest';
import { INGEST_D1_SCHEMA_DDL } from '../stores/d1-schema.sql.js';
import * as schema from './schema.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

interface ColumnShape {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

interface IndexShape {
  name: string;
  unique: boolean;
  columns: string[];
}

interface TableShape {
  columns: ColumnShape[];
  indexes: IndexShape[];
}

type SchemaShape = Record<string, TableShape>;

/** PK 컬럼의 NOT NULL은 dialect·선언 방식마다 표기가 달라 비교에서 제외한다 */
function normalizeColumn(c: ColumnShape): ColumnShape {
  return { ...c, type: c.type.toLowerCase(), notNull: c.primaryKey ? false : c.notNull };
}

function sortShape(shape: SchemaShape): SchemaShape {
  const out: SchemaShape = {};
  for (const table of Object.keys(shape).sort()) {
    out[table] = {
      columns: shape[table].columns
        .map(normalizeColumn)
        .sort((a, b) => a.name.localeCompare(b.name)),
      indexes: [...shape[table].indexes].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  return out;
}

function shapeFromDrizzleSchema(): SchemaShape {
  const shape: SchemaShape = {};
  for (const value of Object.values(schema)) {
    if (!is(value, SQLiteTable)) continue;
    const config = getTableConfig(value);
    const compositePk = new Set(config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)));
    shape[config.name] = {
      columns: config.columns.map((c) => ({
        name: c.name,
        type: c.getSQLType(),
        notNull: c.notNull,
        primaryKey: c.primary || compositePk.has(c.name),
      })),
      indexes: config.indexes.map((idx) => ({
        name: idx.config.name,
        unique: idx.config.unique,
        columns: idx.config.columns.map((c) => (c as { name: string }).name),
      })),
    };
  }
  return sortShape(shape);
}

function shapeFromDatabase(client: DatabaseSync): SchemaShape {
  const tables = client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
    )
    .all() as { name: string }[];
  const shape: SchemaShape = {};
  for (const { name } of tables) {
    const columns = client.prepare(`PRAGMA table_info(${name})`).all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];
    // origin 'c' = CREATE INDEX로 만든 명시 인덱스 (PK·UNIQUE 제약 자동 인덱스 제외)
    const indexes = (
      client.prepare(`PRAGMA index_list(${name})`).all() as {
        name: string;
        unique: number;
        origin: string;
      }[]
    ).filter((idx) => idx.origin === 'c');
    shape[name] = {
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        notNull: c.notnull === 1,
        primaryKey: c.pk > 0,
      })),
      indexes: indexes.map((idx) => ({
        name: idx.name,
        unique: idx.unique === 1,
        columns: (
          client.prepare(`PRAGMA index_info(${idx.name})`).all() as {
            seqno: number;
            name: string;
          }[]
        )
          .sort((a, b) => a.seqno - b.seqno)
          .map((c) => c.name),
      })),
    };
  }
  return sortShape(shape);
}

function createClient(): DatabaseSync {
  return new NodeSqliteDriver(':memory:', null).$client as DatabaseSync;
}

describe('SQLite DDL 정합 (drizzle schema ↔ migration ↔ D1 DDL)', () => {
  const expected = shapeFromDrizzleSchema();

  it('drizzle migration을 적용한 DB가 drizzle schema와 같다', () => {
    const client = createClient();
    migrate(drizzle({ client }), { migrationsFolder });
    expect(shapeFromDatabase(client)).toEqual(expected);
  });

  it('D1 DDL을 적용한 DB가 drizzle schema와 같다', () => {
    const client = createClient();
    client.exec(INGEST_D1_SCHEMA_DDL);
    expect(shapeFromDatabase(client)).toEqual(expected);
  });

  it('이전 migration까지 적용된 기존 DB에 새 migration이 additive로 적용되고 행이 보존된다', () => {
    const migrationNames = readdirSync(migrationsFolder).sort();
    const partialFolder = mkdtempSync(join(tmpdir(), 'ingest-migrations-'));
    try {
      for (const name of migrationNames.slice(0, -1)) {
        cpSync(join(migrationsFolder, name), join(partialFolder, name), { recursive: true });
      }
      const client = createClient();
      const db = drizzle({ client });
      migrate(db, { migrationsFolder: partialFolder });
      client.exec(
        "INSERT INTO event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version, payload_format, payload_encoding, created_at) VALUES ('old', 't', 's', '2026-01-01T00:00:00Z', 'log', 'k', '1', 'json', 'raw', '2026-01-01T00:00:00Z')",
      );

      migrate(db, { migrationsFolder });

      expect(shapeFromDatabase(client)).toEqual(expected);
      expect(
        client.prepare("SELECT log_id, metric_name FROM event_records WHERE log_id = 'old'").get(),
      ).toEqual({ log_id: 'old', metric_name: null });
    } finally {
      rmSync(partialFolder, { recursive: true, force: true });
    }
  });

  it('event_records에 metric_* 컬럼이 있다', () => {
    const columns = expected.event_records.columns.map((c) => c.name);
    expect(columns).toEqual(
      expect.arrayContaining([
        'metric_type',
        'metric_name',
        'metric_value',
        'metric_unit',
        'metric_labels',
        'metric_buckets',
        'metric_quantiles',
      ]),
    );
  });
});
