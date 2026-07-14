// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

/** Metric 슬라이스 LoggerPort 어댑터. namespace = "sim-reporting-api.metric". */
export function createMetricLogger(): LoggerPort {
  const host = createLogger('sim-reporting-api.metric') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
