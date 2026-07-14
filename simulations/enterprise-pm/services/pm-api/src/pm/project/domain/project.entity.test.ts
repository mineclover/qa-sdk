// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { ProjectEntity } from './project.entity.js';
import {
  InvalidProjectIdException,
  InvalidProjectNameException,
  ProjectArchivedException,
  ProjectStatusTransitionException,
} from './project.exceptions.js';

describe('ProjectEntity', () => {
  const baseInput = {
    id: 'prj_001',
    name: 'Demo Project',
    ownerId: 'u_001',
    departmentId: 'dept_eng',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it("create() — status='draft' 기본값", () => {
    const e = ProjectEntity.create(baseInput);
    expect(e.status).toBe('draft');
    expect(e.id).toBe('prj_001');
  });

  it('create() — 빈 id 에 대해 InvalidProjectIdException', () => {
    expect(() => ProjectEntity.create({ ...baseInput, id: '' })).toThrow(InvalidProjectIdException);
  });

  it('create() — 빈 name 에 대해 InvalidProjectNameException', () => {
    expect(() => ProjectEntity.create({ ...baseInput, name: ' ' })).toThrow(
      InvalidProjectNameException,
    );
  });

  it('activate — draft → active 전이', () => {
    const e = ProjectEntity.create(baseInput).activate(new Date('2026-01-02T00:00:00.000Z'));
    expect(e.status).toBe('active');
  });

  it('archive — draft → archived 전이 가능', () => {
    const e = ProjectEntity.create(baseInput).archive();
    expect(e.status).toBe('archived');
  });

  it('archive — active → archived 전이', () => {
    const e = ProjectEntity.create(baseInput).activate().archive();
    expect(e.status).toBe('archived');
  });

  it('activate — archived 에서 호출 시 ProjectArchivedException', () => {
    const archived = ProjectEntity.create(baseInput).archive();
    expect(() => archived.activate()).toThrow(ProjectArchivedException);
  });

  it('applyPatch — archived 에서 패치 시 ProjectArchivedException', () => {
    const archived = ProjectEntity.create(baseInput).archive();
    expect(() => archived.applyPatch({ name: 'Updated' })).toThrow(ProjectArchivedException);
  });

  it('applyPatch — name 변경', () => {
    const e = ProjectEntity.create(baseInput).applyPatch({ name: 'New Name' });
    expect(e.toSnapshot().name).toBe('New Name');
  });

  it("applyPatch — status='active' 전이는 가능", () => {
    const e = ProjectEntity.create(baseInput).applyPatch({ status: 'active' });
    expect(e.status).toBe('active');
  });

  it('applyPatch — active → draft 역전이 금지', () => {
    const active = ProjectEntity.create(baseInput).activate();
    expect(() => active.applyPatch({ status: 'draft' })).toThrow(ProjectStatusTransitionException);
  });

  it('applyPatch — name 빈문자열 금지', () => {
    const e = ProjectEntity.create(baseInput);
    expect(() => e.applyPatch({ name: ' ' })).toThrow(InvalidProjectNameException);
  });

  it('toSnapshot/rehydrate 라운드트립', () => {
    const original = ProjectEntity.create(baseInput).activate(new Date('2026-01-02T00:00:00.000Z'));
    const snapshot = original.toSnapshot();
    const rehydrated = ProjectEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("ProjectArchivedException name = 'ConflictError'", () => {
    expect(new ProjectArchivedException().name).toBe('ConflictError');
  });

  it("InvalidProjectNameException name = 'ValidationError'", () => {
    expect(new InvalidProjectNameException().name).toBe('ValidationError');
  });
});
