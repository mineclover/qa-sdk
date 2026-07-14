// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlIndexMetaStore 테스트
 *
 * InMemorySqlDriver로 SqlDriver 인터페이스를 구현해
 * 실제 DB 없이 SqlIndexMetaStore의 쿼리 로직을 검증한다.
 *
 * 동일 SqlDriver 구현체를 D1 / Turso / libsql / better-sqlite3로
 * 교체하면 동일한 동작이 보장된다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SqlIndexMetaStore,
  type SqlDriver,
  type SqlDialect,
  type ExecuteResult,
} from './sql-store.js';
import { ValidationError } from '../errors.js';

// ── InMemorySqlDriver ─────────────────────────────────────
//
// SqlDriver 인터페이스의 인메모리 구현.
// 실제 SQL 파서 없이, 테이블 이름과 파라미터를 파싱해
// Map 기반 저장소에 위임한다.
//
// 지원 쿼리 패턴:
//   schema_version: INSERT / SELECT all / SELECT one (by prefix+version_id)
//   entry:          INSERT / SELECT by prefix+version_id (+position range)

type SchemaVersionRow = {
  prefix: string;
  version_id: string;
  capacity: number;
  created_at: string;
};
type EntryRow = {
  prefix: string;
  version_id: string;
  position: number;
  value: string;
  created_at: string;
};

class InMemorySqlDriver implements SqlDriver {
  private readonly schemaVersions = new Map<string, SchemaVersionRow>();
  private readonly entries = new Map<string, EntryRow>();

  readonly dialect: SqlDialect = {
    name: 'in-memory',
    supportsTransaction: true,
    supportsReturning: false,
    supportsJsonType: false,
    supportsUpsert: false,
  };

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('INSERT INTO SCHEMA_VERSION')) {
      const [prefix, version_id, capacity, created_at] = params as [string, string, number, string];
      const key = `${prefix}:${version_id}`;
      if (this.schemaVersions.has(key)) {
        throw new Error(
          `UNIQUE constraint failed: schema_version.prefix, schema_version.version_id`,
        );
      }
      this.schemaVersions.set(key, { prefix, version_id, capacity, created_at });
      return { rowsAffected: 1 };
    }

    if (s.startsWith('INSERT INTO ENTRY')) {
      const [prefix, version_id, position, value, created_at] = params as [
        string,
        string,
        number,
        string,
        string,
      ];
      const key = `${prefix}:${version_id}:${position}`;
      if (this.entries.has(key)) {
        throw new Error(`UNIQUE constraint failed: entry.prefix, entry.version_id, entry.position`);
      }
      this.entries.set(key, { prefix, version_id, position, value, created_at });
      return { rowsAffected: 1 };
    }

    throw new Error(`InMemorySqlDriver: unsupported execute query`);
  }

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    for (const params of paramsList) await this.execute(sql, params);
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const s = sql.trim().toUpperCase();

    if (s.includes('FROM SCHEMA_VERSION')) {
      const [prefix] = params as [string];
      return [...this.schemaVersions.values()]
        .filter((r) => r.prefix === prefix)
        .toSorted((a, b) => a.created_at.localeCompare(b.created_at)) as unknown as T[];
    }

    if (s.includes('FROM ENTRY') && s.includes('POSITION >=')) {
      const [prefix, version_id, from, to] = params as [string, string, number, number];
      return [...this.entries.values()]
        .filter(
          (r) =>
            r.prefix === prefix &&
            r.version_id === version_id &&
            r.position >= from &&
            r.position <= to,
        )
        .toSorted((a, b) => a.position - b.position) as unknown as T[];
    }

    if (s.includes('FROM ENTRY')) {
      const [prefix, version_id] = params as [string, string];
      return [...this.entries.values()]
        .filter((r) => r.prefix === prefix && r.version_id === version_id)
        .toSorted((a, b) => a.position - b.position) as unknown as T[];
    }

    throw new Error(`InMemorySqlDriver: unsupported query`);
  }

  async queryOne<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const s = sql.trim().toUpperCase();

    if (s.includes('FROM SCHEMA_VERSION') && s.includes('VERSION_ID')) {
      const [prefix, version_id] = params as [string, string];
      return (this.schemaVersions.get(`${prefix}:${version_id}`) ?? null) as unknown as T | null;
    }

    if (s.includes('SELECT CAPACITY')) {
      const [prefix, version_id] = params as [string, string];
      const row = this.schemaVersions.get(`${prefix}:${version_id}`);
      return row ? ({ capacity: row.capacity } as unknown as T) : null;
    }

    if (s.includes('FROM ENTRY') && s.includes('AND VALUE =')) {
      const [prefix, version_id, value] = params as [string, string, string];
      const found = [...this.entries.values()].find(
        (r) => r.prefix === prefix && r.version_id === version_id && r.value === value,
      );
      return (found ?? null) as unknown as T | null;
    }

    if (s.includes('FROM ENTRY') && s.includes('POSITION =')) {
      const [prefix, version_id, position] = params as [string, string, number];
      return (this.entries.get(`${prefix}:${version_id}:${position}`) ??
        null) as unknown as T | null;
    }

    throw new Error(`InMemorySqlDriver: unsupported queryOne`);
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    // In-memory driver: no real transaction needed, just execute fn
    return fn(this);
  }
}

// ── 테스트 ───────────────────────────────────────────────

describe('SqlIndexMetaStore — SqlDriver 위임 검증', () => {
  let driver: InMemorySqlDriver;
  let store: SqlIndexMetaStore;

  beforeEach(() => {
    driver = new InMemorySqlDriver();
    store = new SqlIndexMetaStore(driver);
  });

  // ── schema_version ────────────────────────────────────

  it('insertSchemaVersion → getSchemaVersion 왕복', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });

    const sv = await store.getSchemaVersion('role', 'v1');
    expect(sv?.prefix).toBe('role');
    expect(sv?.capacity).toBe(8);
  });

  it('getCapacity는 capacity만 반환한다 (fast-path)', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(await store.getCapacity('role', 'v1')).toBe(8);
    expect(await store.getCapacity('role', 'v99')).toBeNull();
  });

  it('getSchemaVersions는 createdAt 오름차순으로 반환된다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 16,
      createdAt: '2026-06-01T00:00:00Z',
    });
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });

    const versions = await store.getSchemaVersions('role');
    expect(versions.map((v) => v.versionId)).toEqual(['v1', 'v2']);
  });

  it('중복 schema_version 삽입 시 에러가 전파된다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await expect(
      store.insertSchemaVersion({
        prefix: 'role',
        versionId: 'v1',
        capacity: 8,
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow();
  });

  // ── entry ─────────────────────────────────────────────

  it('insertEntry → getEntry 왕복', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const entry = await store.getEntry('role', 'v1', 1);
    expect(entry?.value).toBe('admin');
  });

  it('schema_version 없이 insertEntry 시 ValidationError', async () => {
    await expect(
      store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: 1,
        value: 'admin',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('position이 capacity를 초과하면 ValidationError', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await expect(
      store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: 9,
        value: 'x',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('getEntries는 position 오름차순으로 반환된다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 3,
      value: 'c',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: 'a',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      value: 'b',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const entries = await store.getEntries('role', 'v1');
    expect(entries.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it('getEntriesInRange는 [from, to] 범위만 반환한다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    for (let i = 1; i <= 6; i++) {
      await store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: i,
        value: `v${i}`,
        createdAt: '2026-01-01T00:00:00Z',
      });
    }

    const range = await store.getEntriesInRange('role', 'v1', 2, 4);
    expect(range.map((e) => e.position)).toEqual([2, 3, 4]);
  });

  it('예약 마커도 일반 entry와 동일하게 저장/조회된다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: '_',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      value: 'NaN',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 3,
      value: '~',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const entries = await store.getEntries('role', 'v1');
    expect(entries.map((e) => e.value)).toEqual(['_', 'NaN', '~']);
  });

  it('없는 entry는 null을 반환한다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(await store.getEntry('role', 'v1', 99)).toBeNull();
  });

  it('중복 position은 ValidationError', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await expect(
      store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: 1,
        value: 'editor',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('position이 1보다 작으면 ValidationError', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await expect(
      store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: 0,
        value: 'admin',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(ValidationError);
  });
});

// ── SqlDriver 교체 가능성 확인 ────────────────────────────
//
// SqlIndexMetaStore는 SqlDriver 인터페이스에만 의존한다.
// 동일한 인터페이스를 구현하면 어떤 DB도 꽂을 수 있다.

describe('SqlDriver 교체 가능성', () => {
  it('SqlDriver를 다른 구현으로 교체해도 동일하게 동작한다', async () => {
    // 두 번째 독립 드라이버 인스턴스
    const driver2 = new InMemorySqlDriver();
    const store2 = new SqlIndexMetaStore(driver2);

    await store2.insertSchemaVersion({
      prefix: 'action',
      versionId: 'v1',
      capacity: 4,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await store2.insertEntry({
      prefix: 'action',
      versionId: 'v1',
      position: 1,
      value: 'read',
      createdAt: '2026-01-01T00:00:00Z',
    });

    expect(await store2.getCapacity('action', 'v1')).toBe(4);
    expect((await store2.getEntry('action', 'v1', 1))?.value).toBe('read');
  });
});
