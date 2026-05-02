// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type HostLoggerLike,
  type LoggerPort,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../lib/logger.js";

/**
 * Graph Explorer 슬라이스 LoggerPort 어댑터.
 *
 * 호스트 (sim-audit-browser-api) 의 pino 기반 createLogger 를 sim-domain-slice-kit
 * 의 LoggerPort 로 감싼다. namespace = "sim-audit-browser-api.graph-explorer".
 */
export function createGraphExplorerLogger(): LoggerPort {
  const host = createLogger("sim-audit-browser-api.graph-explorer") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
