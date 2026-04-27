// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

export function createMemberLogger(): LoggerPort {
  const host = createLogger("sim-pm-api.member") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
