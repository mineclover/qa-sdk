// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

/**
 * Document 슬라이스 LoggerPort 어댑터.
 */
export function createDocumentLogger(): LoggerPort {
  const host = createLogger('sim-document-api.document') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
