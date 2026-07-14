// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

export function createRoleAssignmentLogger(): LoggerPort {
  const host = createLogger('sim-auth-api.role-assignment') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
