// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { TransactionPort, TransactionScope } from '@qa-sdk/sim-domain-slice-kit';

/**
 * User 슬라이스의 TransactionPort.
 *
 * sim-domain-slice-kit 의 TransactionPort 를 그대로 채택. infrastructure 의
 * dialect 별 어댑터(`createSqliteTransactionPort` / `createPgTransactionPort`)가
 * 이 토큰에 바인딩된다.
 */
export type UserTransactionPort = TransactionPort;
export type UserTransactionScope = TransactionScope;
