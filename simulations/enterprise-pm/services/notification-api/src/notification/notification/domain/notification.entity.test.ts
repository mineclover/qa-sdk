// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { NotificationEntity } from './notification.entity.js';
import {
  InvalidNotificationIdException,
  NotificationTerminalStateException,
} from './notification.exceptions.js';

describe('NotificationEntity', () => {
  const baseInput = {
    id: 'ntf_001',
    recipientUserId: 'usr_001',
    type: 'budget.approved',
    title: 'Budget approved',
    body: 'Your budget request was approved.',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it("create() 는 status='pending' 으로 시작한다", () => {
    const e = NotificationEntity.create(baseInput);
    expect(e.status).toBe('pending');
    expect(e.id).toBe('ntf_001');
    expect(e.recipientUserId).toBe('usr_001');
  });

  it('create() 는 빈 id 에 대해 InvalidNotificationIdException 을 던진다', () => {
    expect(() => NotificationEntity.create({ ...baseInput, id: '  ' })).toThrow(
      InvalidNotificationIdException,
    );
  });

  it('markSent() 은 pending → sent 전이를 수행하고 sentAt 을 설정한다', () => {
    const sentAt = new Date('2026-01-02T00:00:00.000Z');
    const e = NotificationEntity.create(baseInput).markSent(sentAt);
    expect(e.status).toBe('sent');
    expect(e.toSnapshot().sentAt).toBe(sentAt.toISOString());
  });

  it('markRead() 은 read 상태로 전이하고 readAt 을 설정한다', () => {
    const readAt = new Date('2026-01-03T00:00:00.000Z');
    const e = NotificationEntity.create(baseInput).markSent().markRead(readAt);
    expect(e.status).toBe('read');
    expect(e.toSnapshot().readAt).toBe(readAt.toISOString());
  });

  it('markFailed() 은 pending/sent 에서 failed 로 전이한다', () => {
    const e = NotificationEntity.create(baseInput).markFailed();
    expect(e.status).toBe('failed');
  });

  it('read 상태에서 markSent/markRead/markFailed 호출 시 ConflictError', () => {
    const read = NotificationEntity.create(baseInput).markRead();
    expect(() => read.markSent()).toThrow(NotificationTerminalStateException);
    expect(() => read.markRead()).toThrow(NotificationTerminalStateException);
    expect(() => read.markFailed()).toThrow(NotificationTerminalStateException);
  });

  it('failed 상태에서 markSent/markRead 시 ConflictError', () => {
    const failed = NotificationEntity.create(baseInput).markFailed();
    expect(() => failed.markSent()).toThrow(NotificationTerminalStateException);
    expect(() => failed.markRead()).toThrow(NotificationTerminalStateException);
  });

  it('markSent() 은 새 인스턴스를 반환한다 (불변)', () => {
    const pending = NotificationEntity.create(baseInput);
    const sent = pending.markSent();
    expect(sent).not.toBe(pending);
    expect(pending.status).toBe('pending');
    expect(sent.status).toBe('sent');
  });

  it('toSnapshot() / rehydrate() 는 라운드트립을 보존한다', () => {
    const original = NotificationEntity.create(baseInput).markSent(
      new Date('2026-01-02T00:00:00.000Z'),
    );
    const snapshot = original.toSnapshot();
    const rehydrated = NotificationEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("InvalidNotificationIdException name 이 'ValidationError' 매핑된다", () => {
    const err = new InvalidNotificationIdException();
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('INVALID_NOTIFICATION_ID');
  });

  it("NotificationTerminalStateException name 이 'ConflictError' 매핑된다", () => {
    const err = new NotificationTerminalStateException('read', 'markSent');
    expect(err.name).toBe('ConflictError');
    expect(err.code).toBe('NOTIFICATION_TERMINAL_STATE');
  });
});
