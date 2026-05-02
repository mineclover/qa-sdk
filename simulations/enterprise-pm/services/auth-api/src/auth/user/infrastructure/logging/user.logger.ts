// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from "@qa-sdk/sim-domain-slice-kit";
import { createLogger } from "../../../../lib/logger.js";

/**
 * User 슬라이스 LoggerPort 어댑터.
 *
 * 호스트 (sim-auth-api) 의 pino 기반 createLogger("sim-auth-api.user") 를
 * sim-domain-slice-kit 의 LoggerPort 로 감싼다.
 */
export function createUserLogger(): LoggerPort {
  const host = createLogger("sim-auth-api.user") as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
