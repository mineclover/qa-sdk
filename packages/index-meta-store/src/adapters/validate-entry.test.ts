// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * validate-entry.test.ts — validateEntryForInsert 유닛 테스트
 *
 * 공유 검증 함수의 세 가지 체크를 독립적으로 검증한다:
 * 1. 스키마 버전 존재 여부
 * 2. position 범위 [1, capacity]
 * 3. 중복 position 거부
 */

import { describe, it, expect } from 'vitest';
import { validateEntryForInsert } from './validate-entry.js';
import { ValidationError } from 'index-meta';
import type { SchemaVersionRecord, EntryRecord } from 'index-meta';

// ── 픽스처 ────────────────────────────────────────────────

const sv = (capacity = 8): SchemaVersionRecord => ({
  prefix: 'role',
  versionId: 'v1',
  capacity,
  createdAt: '2026-01-01T00:00:00Z',
});

const entry = (position = 1): EntryRecord => ({
  prefix: 'role',
  versionId: 'v1',
  position,
  value: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
});

// ── 테스트 ────────────────────────────────────────────────

describe('validateEntryForInsert', () => {
  it('유효한 entry는 예외 없이 통과한다', () => {
    expect(() => validateEntryForInsert(entry(1), sv(8), null)).not.toThrow();
  });

  it('capacity 경계값(position === capacity)은 통과한다', () => {
    expect(() => validateEntryForInsert(entry(8), sv(8), null)).not.toThrow();
  });

  it('position === 1은 통과한다', () => {
    expect(() => validateEntryForInsert(entry(1), sv(8), null)).not.toThrow();
  });

  it('스키마 버전이 없으면 ValidationError', () => {
    expect(() => validateEntryForInsert(entry(1), null, null)).toThrow(ValidationError);
    expect(() => validateEntryForInsert(entry(1), null, null)).toThrow(/SchemaVersion not found/);
  });

  it('position < 1이면 ValidationError', () => {
    expect(() => validateEntryForInsert(entry(0), sv(8), null)).toThrow(ValidationError);
    expect(() => validateEntryForInsert(entry(0), sv(8), null)).toThrow(/out of range/);
  });

  it('음수 position이면 ValidationError', () => {
    expect(() => validateEntryForInsert(entry(-1), sv(8), null)).toThrow(ValidationError);
  });

  it('position > capacity이면 ValidationError', () => {
    expect(() => validateEntryForInsert(entry(9), sv(8), null)).toThrow(ValidationError);
    expect(() => validateEntryForInsert(entry(9), sv(8), null)).toThrow(/out of range/);
  });

  it('중복 position(existing entry 존재)이면 ValidationError', () => {
    const existing = entry(1);
    expect(() => validateEntryForInsert(entry(1), sv(8), existing)).toThrow(ValidationError);
    expect(() => validateEntryForInsert(entry(1), sv(8), existing)).toThrow(/already exists/);
  });

  it('에러 메시지에 prefix/versionId가 포함된다 (스키마 버전 없음)', () => {
    const e = entry(1);
    expect(() => validateEntryForInsert(e, null, null)).toThrow(/role\/v1/);
  });

  it('에러 메시지에 position과 capacity가 포함된다 (범위 초과)', () => {
    expect(() => validateEntryForInsert(entry(10), sv(8), null)).toThrow(/10/);
    expect(() => validateEntryForInsert(entry(10), sv(8), null)).toThrow(/8/);
  });
});
