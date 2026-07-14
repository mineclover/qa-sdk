// @def.boundary definition-catalog-spec
// @def.doc coordinate-storage

import { describe, expect, it } from 'vitest';

import {
  parseDrizzleTables,
  checkCoordinateStorage,
  type CoordStorageViolation,
  type ScannedTable,
} from './coordinate-storage-check.js';

describe('parseDrizzleTables', () => {
  it('sqliteTable 선언과 컬럼 추출', () => {
    const code = `
      import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

      export const events = sqliteTable("events", {
        eventId: text("event_id").primaryKey(),
        prefixId: text("prefix_id").notNull(),
        version: text("version").notNull(),
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables('events.ts', code);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('events');
    expect(tables[0].columnNames).toEqual(
      expect.arrayContaining(['eventId', 'prefixId', 'version', 'address']),
    );
  });

  it('pgTable도 검출', () => {
    const code = `
      import { integer, pgTable, text } from "drizzle-orm/pg-core";
      export const t = pgTable("t", {
        id: text("id").primaryKey(),
        address: integer("address"),
      });
    `;
    const tables = parseDrizzleTables('t.ts', code);
    expect(tables).toHaveLength(1);
    expect(tables[0].dialect).toBe('pg');
  });

  it('exempt 주석이 있으면 isExempt=true + reason 추출', () => {
    const code = `
      // @def.coord-storage-exempt: legacy table, scheduled for migration
      export const legacy = sqliteTable("legacy", {
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables('legacy.ts', code);
    expect(tables[0].isExempt).toBe(true);
    expect(tables[0].exemptReason).toBe('legacy table, scheduled for migration');
  });

  it('exempt 사유 비어있으면 isExempt=false (사유 강제)', () => {
    const code = `
      // @def.coord-storage-exempt:
      export const t = sqliteTable("t", {
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables('t.ts', code);
    expect(tables[0].isExempt).toBe(false);
  });

  it('uniqueIndex 컬럼에서 callback alias를 제거해 coordinate unique를 인식한다', () => {
    const code = `
      import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

      export const semanticTerms = sqliteTable(
        "semantic_terms",
        {
          prefixId: text("prefix_id"),
          version: text("version"),
          address: integer("address"),
        },
        (table) => [
          uniqueIndex("semantic_terms_coord_unique").on(table.prefixId, table.version, table.address),
        ],
      );
    `;

    const tables = parseDrizzleTables('schema.ts', code);

    expect(tables[0].hasUniqueOnCoord).toBe(true);
  });
});

describe('checkCoordinateStorage — 위반 분류', () => {
  it('좌표 저장 후보 + version + 복합 PK = 위반 없음', () => {
    const tables: ScannedTable[] = [
      {
        filePath: 'ok.ts',
        name: 'events',
        dialect: 'sqlite',
        columnNames: ['prefixId', 'version', 'address'],
        compositePkColumns: ['prefixId', 'version', 'address'],
        hasUniqueOnCoord: false,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it('address 있는데 version 없음 → missing-version', () => {
    const tables: ScannedTable[] = [
      {
        filePath: 'bad.ts',
        name: 'events',
        dialect: 'sqlite',
        columnNames: ['prefixId', 'address'],
        compositePkColumns: ['prefixId', 'address'],
        hasUniqueOnCoord: false,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    const violations = checkCoordinateStorage(tables);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('missing-version');
  });

  it('address 있는데 prefix 시그널 없음 → not-coord-storage (스킵)', () => {
    // address 컬럼이 있지만 prefix_id도 packed_key도 없음 → 좌표 저장 아님
    const tables: ScannedTable[] = [
      {
        filePath: 'addr.ts',
        name: 'ip_log',
        dialect: 'sqlite',
        columnNames: ['id', 'address', 'city'], // 'address' = IP/주소 등
        compositePkColumns: ['id'],
        hasUniqueOnCoord: false,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it('packedKey + prefixId 있는데 PK가 단일 packed_key → missing-composite-pk', () => {
    const tables: ScannedTable[] = [
      {
        filePath: 'obs.ts',
        name: 'observations',
        dialect: 'sqlite',
        columnNames: ['packedKey', 'prefixId', 'version'],
        compositePkColumns: ['packedKey'], // 위반: version·prefix가 PK에 없음
        hasUniqueOnCoord: false,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    const violations = checkCoordinateStorage(tables);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('missing-composite-pk');
  });

  it('UNIQUE 제약으로 (prefix_id, version, packed_key) 보장 → 통과', () => {
    const tables: ScannedTable[] = [
      {
        filePath: 'obs.ts',
        name: 'observations',
        dialect: 'sqlite',
        columnNames: ['packedKey', 'prefixId', 'version'],
        compositePkColumns: ['packedKey'],
        hasUniqueOnCoord: true,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it('isExempt=true는 모든 검사 우회', () => {
    const tables: ScannedTable[] = [
      {
        filePath: 'legacy.ts',
        name: 'legacy',
        dialect: 'sqlite',
        columnNames: ['packedKey'], // 정상이면 위반인데
        compositePkColumns: ['packedKey'],
        hasUniqueOnCoord: false,
        isExempt: true,
        exemptReason: '운영 데이터 보존, 2026Q3 이행 예정',
        lineNumber: 1,
      },
    ];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it('aggregate 테이블 (prefix_id PK + version 컬럼) → 통과', () => {
    // key_observation_prefixes 패턴
    const tables: ScannedTable[] = [
      {
        filePath: 'agg.ts',
        name: 'prefix_aggregates',
        dialect: 'sqlite',
        columnNames: ['prefixId', 'version', 'distinctKeys', 'totalCount'],
        compositePkColumns: ['prefixId', 'version'],
        hasUniqueOnCoord: false,
        isExempt: false,
        lineNumber: 1,
      },
    ];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });
});
