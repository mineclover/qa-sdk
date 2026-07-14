import { describe, expect, it } from 'vitest';
import { extractFingerprint, extractOperation, extractTable } from './fingerprint.js';

describe('extractFingerprint', () => {
  it('postgres 바인드 파라미터를 ? 로 치환', () => {
    const sql = `SELECT "id", "name" FROM "users" WHERE "id" = $1 AND "status" = $2`;
    expect(extractFingerprint(sql)).toBe(
      `SELECT "id", "name" FROM "users" WHERE "id" = ? AND "status" = ?`,
    );
  });

  it('문자열 리터럴을 ? 로 치환', () => {
    const sql = `SELECT * FROM users WHERE name = 'alice' AND city = 'seoul'`;
    expect(extractFingerprint(sql)).toBe(`SELECT * FROM users WHERE name = ? AND city = ?`);
  });

  it('숫자 리터럴을 ? 로 치환', () => {
    const sql = `SELECT * FROM users WHERE age > 25 AND score = 99.5`;
    expect(extractFingerprint(sql)).toBe(`SELECT * FROM users WHERE age > ? AND score = ?`);
  });

  it('IN 절의 다중 파라미터를 IN (?) 으로 압축', () => {
    const sql = `SELECT * FROM users WHERE id IN ($1, $2, $3, $4)`;
    expect(extractFingerprint(sql)).toBe(`SELECT * FROM users WHERE id IN (?)`);
  });

  it('연속 공백을 단일 공백으로 정규화', () => {
    const sql = `SELECT   *    FROM    users   WHERE id = $1`;
    expect(extractFingerprint(sql)).toBe(`SELECT * FROM users WHERE id = ?`);
  });

  it('복합 쿼리 정규화', () => {
    const sql = `INSERT INTO "event_records" ("log_id", "trace_id", "timestamp") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`;
    const fp = extractFingerprint(sql);
    expect(fp).toContain('INSERT INTO');
    expect(fp).toContain('event_records');
    expect(fp).not.toContain('$1');
  });
});

describe('extractOperation', () => {
  it('SELECT 인식', () => {
    expect(extractOperation('SELECT * FROM users')).toBe('select');
  });

  it('INSERT 인식', () => {
    expect(extractOperation('INSERT INTO users VALUES (1)')).toBe('insert');
  });

  it('UPDATE 인식', () => {
    expect(extractOperation("UPDATE users SET name = 'a'")).toBe('update');
  });

  it('DELETE 인식', () => {
    expect(extractOperation('DELETE FROM users WHERE id = 1')).toBe('delete');
  });

  it('알 수 없는 형태는 select fallback', () => {
    expect(extractOperation('WITH cte AS (...)')).toBe('select');
  });

  it('앞 공백 처리', () => {
    expect(extractOperation('  INSERT INTO users VALUES (1)')).toBe('insert');
  });
});

describe('extractTable', () => {
  it('SELECT ... FROM table', () => {
    expect(extractTable(`SELECT * FROM "users" WHERE id = 1`)).toBe('users');
  });

  it('INSERT INTO table', () => {
    expect(extractTable(`INSERT INTO "event_records" ("id") VALUES (1)`)).toBe('event_records');
  });

  it('UPDATE table', () => {
    expect(extractTable(`UPDATE "traces" SET status = 'done'`)).toBe('traces');
  });

  it('DELETE FROM table', () => {
    expect(extractTable(`DELETE FROM "sessions" WHERE id = 1`)).toBe('sessions');
  });

  it('따옴표 없는 테이블 인식', () => {
    expect(extractTable('SELECT * FROM users WHERE id = 1')).toBe('users');
  });

  it('테이블 없으면 undefined', () => {
    expect(extractTable('SELECT 1')).toBeUndefined();
  });
});
