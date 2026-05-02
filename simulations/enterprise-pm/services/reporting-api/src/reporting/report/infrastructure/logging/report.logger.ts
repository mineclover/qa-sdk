// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

/** Report 슬라이스 LoggerPort 어댑터. namespace = "sim-reporting-api.report". */
export function createReportLogger(): LoggerPort {
  const host = createLogger("sim-reporting-api.report") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
