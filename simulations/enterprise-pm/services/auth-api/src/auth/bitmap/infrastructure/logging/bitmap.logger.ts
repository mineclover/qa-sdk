// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

export function createBitmapLogger(): LoggerPort {
  const host = createLogger("sim-auth-api.bitmap") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
