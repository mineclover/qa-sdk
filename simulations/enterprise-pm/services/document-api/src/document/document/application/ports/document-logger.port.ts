// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Document 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 인터페이스를 슬라이스 의존 표면으로 노출.
 */
import type { LoggerPort, SliceLogContext } from "@qa-sdk/sim-domain-slice-kit";

export type DocumentLoggerPort = LoggerPort;
export type DocumentLogContext = SliceLogContext;
