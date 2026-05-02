// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Task 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 를 슬라이스 의존 표면으로 노출.
 */
import type { LoggerPort, SliceLogContext } from "@qa-sdk/sim-domain-slice-kit";

export type TaskLoggerPort = LoggerPort;
export type TaskLogContext = SliceLogContext;
