// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { DocumentEntity } from './document.entity.js';
import {
  InvalidDocumentIdException,
  InvalidDocumentTitleException,
} from './document.exceptions.js';

describe('DocumentEntity', () => {
  const baseInput = {
    id: 'doc_001',
    projectId: 'prj_001',
    title: 'Spec Document',
    ownerId: 'usr_001',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('create() 는 currentVersion=0 으로 시작한다', () => {
    const e = DocumentEntity.create(baseInput);
    expect(e.currentVersion).toBe(0);
    expect(e.id).toBe('doc_001');
    expect(e.title).toBe('Spec Document');
  });

  it('create() 는 빈 id 에 대해 InvalidDocumentIdException 을 던진다', () => {
    expect(() => DocumentEntity.create({ ...baseInput, id: '  ' })).toThrow(
      InvalidDocumentIdException,
    );
  });

  it('create() 는 빈 title 에 대해 InvalidDocumentTitleException 을 던진다', () => {
    expect(() => DocumentEntity.create({ ...baseInput, title: '  ' })).toThrow(
      InvalidDocumentTitleException,
    );
  });

  it('update() 는 새 인스턴스를 반환한다 (불변)', () => {
    const original = DocumentEntity.create(baseInput);
    const updated = original.update({ title: 'Renamed' }, new Date('2026-01-02T00:00:00.000Z'));
    expect(updated).not.toBe(original);
    expect(original.title).toBe('Spec Document');
    expect(updated.title).toBe('Renamed');
  });

  it('update() 는 빈 title 에 대해 InvalidDocumentTitleException 을 던진다', () => {
    const e = DocumentEntity.create(baseInput);
    expect(() => e.update({ title: '' })).toThrow(InvalidDocumentTitleException);
  });

  it('incrementVersion() 은 currentVersion 을 +1 증가시킨다', () => {
    const e = DocumentEntity.create(baseInput).incrementVersion(
      new Date('2026-01-02T00:00:00.000Z'),
    );
    expect(e.currentVersion).toBe(1);
  });

  it('toSnapshot() / rehydrate() 라운드트립 보존', () => {
    const original = DocumentEntity.create(baseInput).incrementVersion(
      new Date('2026-01-02T00:00:00.000Z'),
    );
    const snapshot = original.toSnapshot();
    const rehydrated = DocumentEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("InvalidDocumentTitleException name='ValidationError'", () => {
    const err = new InvalidDocumentTitleException();
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('INVALID_DOCUMENT_TITLE');
  });
});
