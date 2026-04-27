// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

export function createBudgetLogger(): LoggerPort {
  const host = createLogger("sim-approval-api.budget") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
