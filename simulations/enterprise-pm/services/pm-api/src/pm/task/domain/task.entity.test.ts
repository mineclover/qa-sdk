// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { TaskEntity } from './task.entity.js';
import {
  InvalidTaskIdException,
  InvalidTaskTitleException,
  TaskTransitionDoneException,
} from './task.exceptions.js';

describe('TaskEntity', () => {
  const baseInput = {
    id: 'tsk_001',
    projectId: 'prj_001',
    title: 'Implement feature',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it("create() 는 status='todo' 로 시작한다", () => {
    const e = TaskEntity.create(baseInput);
    expect(e.status).toBe('todo');
    expect(e.id).toBe('tsk_001');
  });

  it('create() 는 빈 id 에 대해 InvalidTaskIdException 을 던진다', () => {
    expect(() => TaskEntity.create({ ...baseInput, id: '  ' })).toThrow(InvalidTaskIdException);
  });

  it('create() 는 빈 title 에 대해 InvalidTaskTitleException 을 던진다', () => {
    expect(() => TaskEntity.create({ ...baseInput, title: ' ' })).toThrow(
      InvalidTaskTitleException,
    );
  });

  it('transition() 은 todo → in_progress 상태 전이', () => {
    const e = TaskEntity.create(baseInput).transition(
      'in_progress',
      new Date('2026-01-02T00:00:00.000Z'),
    );
    expect(e.status).toBe('in_progress');
  });

  it('transition() 은 새 인스턴스를 반환한다 (불변)', () => {
    const todo = TaskEntity.create(baseInput);
    const inProgress = todo.transition('in_progress');
    expect(inProgress).not.toBe(todo);
    expect(todo.status).toBe('todo');
  });

  it('done 상태에서 다른 상태로 transition() 시 ConflictError', () => {
    const done = TaskEntity.create(baseInput).transition('done');
    expect(() => done.transition('todo')).toThrow(TaskTransitionDoneException);
  });

  it('applyPatch — title/status 변경', () => {
    const e = TaskEntity.create(baseInput);
    const patched = e.applyPatch({ title: 'Updated', status: 'in_progress' });
    expect(patched.toSnapshot().title).toBe('Updated');
    expect(patched.status).toBe('in_progress');
  });

  it('toSnapshot() / rehydrate() 라운드트립 보존', () => {
    const original = TaskEntity.create({ ...baseInput, assigneeId: 'u-1' }).transition(
      'in_progress',
      new Date('2026-01-02T00:00:00.000Z'),
    );
    const snapshot = original.toSnapshot();
    const rehydrated = TaskEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("InvalidTaskTitleException name 이 'ValidationError' 매핑", () => {
    const err = new InvalidTaskTitleException();
    expect(err.name).toBe('ValidationError');
  });

  it("TaskTransitionDoneException name 이 'ConflictError' 매핑", () => {
    const err = new TaskTransitionDoneException();
    expect(err.name).toBe('ConflictError');
  });
});
