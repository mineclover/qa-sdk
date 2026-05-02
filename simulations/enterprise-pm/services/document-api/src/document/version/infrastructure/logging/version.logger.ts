// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

export function createVersionLogger(): LoggerPort {
  const host = createLogger("sim-document-api.version") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
