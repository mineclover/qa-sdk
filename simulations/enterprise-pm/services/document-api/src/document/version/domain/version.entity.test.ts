// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { VersionEntity } from './version.entity.js';
import {
  InvalidVersionContentRefException,
  InvalidVersionDocumentIdException,
  InvalidVersionNumberException,
} from './version.exceptions.js';

describe('VersionEntity', () => {
  const baseInput = {
    documentId: 'doc_001',
    versionNumber: 1,
    contentRef: 's3://bucket/key1',
    authorId: 'u',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('create() 기본 케이스', () => {
    const v = VersionEntity.create(baseInput);
    expect(v.documentId).toBe('doc_001');
    expect(v.versionNumber).toBe(1);
  });

  it('create() — 빈 documentId', () => {
    expect(() => VersionEntity.create({ ...baseInput, documentId: '' })).toThrow(
      InvalidVersionDocumentIdException,
    );
  });

  it('create() — 빈 contentRef', () => {
    expect(() => VersionEntity.create({ ...baseInput, contentRef: '' })).toThrow(
      InvalidVersionContentRefException,
    );
  });

  it('create() — versionNumber 0 또는 음수', () => {
    expect(() => VersionEntity.create({ ...baseInput, versionNumber: 0 })).toThrow(
      InvalidVersionNumberException,
    );
    expect(() => VersionEntity.create({ ...baseInput, versionNumber: -1 })).toThrow(
      InvalidVersionNumberException,
    );
  });

  it('toSnapshot/rehydrate 라운드트립', () => {
    const v = VersionEntity.create(baseInput);
    const s = v.toSnapshot();
    expect(VersionEntity.rehydrate(s).toSnapshot()).toEqual(s);
  });
});
