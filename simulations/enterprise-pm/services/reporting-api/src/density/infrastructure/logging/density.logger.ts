// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../lib/logger.js";

/** Density 슬라이스 LoggerPort 어댑터. namespace = "sim-reporting-api.density". */
export function createDensityLogger(): LoggerPort {
  const host = createLogger("sim-reporting-api.density") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
