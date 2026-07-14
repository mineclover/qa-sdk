// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

export function createSubscriptionLogger(): LoggerPort {
  const host = createLogger('sim-notification-api.subscription') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
