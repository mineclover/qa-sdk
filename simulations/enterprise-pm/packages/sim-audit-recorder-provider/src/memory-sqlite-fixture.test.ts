// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it } from 'vitest';
import { createInMemorySqliteFixture, AUDIT_ENTRIES_DDL } from './memory-sqlite-fixture.js';

describe('memory-sqlite-fixture', () => {
  it('createInMemorySqliteFixture — sqlite :memory: + DDL 적용', () => {
    const fixture = createInMemorySqliteFixture();
    expect(fixture.db).toBeDefined();
    const tables = fixture.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = new Set(tables.map((t) => t.name));
    // audit-recorder-store 의 실 테이블 이름 — audit_entries
    expect(names.has('audit_entries')).toBe(true);
    fixture.close();
  });

  it('AUDIT_ENTRIES_DDL — audit-recorder-store 의 SQLite DDL 과 일치', () => {
    expect(AUDIT_ENTRIES_DDL).toContain('CREATE TABLE');
    expect(AUDIT_ENTRIES_DDL).toMatch(/audit_entries/);
  });

  it('close() 호출 후 추가 쿼리는 실패', () => {
    const fixture = createInMemorySqliteFixture();
    fixture.close();
    expect(() => fixture.sqlite.prepare('SELECT 1').get()).toThrow();
  });
});
