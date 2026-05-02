// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

export function createCommentLogger(): LoggerPort {
  const host = createLogger("sim-document-api.comment") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
