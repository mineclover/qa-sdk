// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

/**
 * User 슬라이스의 OutboxPort.
 *
 * sim-domain-slice-kit 의 OutboxPort 를 그대로 사용. payload 형식만 슬라이스가
 * 결정한다.
 */
export type UserOutboxPort = OutboxPort;
export type UserOutboxRecord = OutboxRecord;

/** 도메인 이벤트 payload — user.created v1. */
export interface UserCreatedEventPayload {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — user.updated v1. */
export interface UserUpdatedEventPayload {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — user.deleted v1. */
export interface UserDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
