// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Graph Explorer 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 인터페이스를 슬라이스 의존 표면으로 노출.
 * BFF/housekeeping 이 본 port 에 의존, infrastructure 가 구현체 주입.
 */
import type { LoggerPort, SliceLogContext } from "@qa-sdk/sim-domain-slice-kit";

export type GraphExplorerLoggerPort = LoggerPort;
export type GraphExplorerLogContext = SliceLogContext;
