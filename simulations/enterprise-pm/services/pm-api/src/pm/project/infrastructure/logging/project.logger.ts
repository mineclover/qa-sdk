// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

export function createProjectLogger(): LoggerPort {
  const host = createLogger('sim-pm-api.project') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
