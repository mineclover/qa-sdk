// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { TransactionPort, TransactionScope } from '@qa-sdk/sim-domain-slice-kit';

/**
 * Notification 슬라이스의 TransactionPort.
 *
 * sim-domain-slice-kit 의 TransactionPort 를 그대로 채택.
 */
export type NotificationTransactionPort = TransactionPort;
export type NotificationTransactionScope = TransactionScope;
