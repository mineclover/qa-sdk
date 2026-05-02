// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// outbox admin endpoint 의존성 토큰 (Stage 4 §4.1).
// repo / dispatcher factory 를 모듈 wiring 단계에서 교체할 수 있도록 분리한다.

export const OUTBOX_ADMIN_REPO = Symbol("OUTBOX_ADMIN_REPO");
export const OUTBOX_DISPATCHER_FACTORY = Symbol("OUTBOX_DISPATCHER_FACTORY");

export interface OutboxAdminRepoTx {
  /** 단일 트랜잭션 안에서 N건 outbox row 를 INSERT 후 id 배열 반환. */
  insertMany(rows: Array<Record<string, unknown>>): Promise<string[]>;
}

export interface OutboxAdminRepo {
  /** 콜백을 단일 트랜잭션으로 감싼다. */
  transaction<T>(cb: (tx: OutboxAdminRepoTx) => Promise<T>): Promise<T>;
}
