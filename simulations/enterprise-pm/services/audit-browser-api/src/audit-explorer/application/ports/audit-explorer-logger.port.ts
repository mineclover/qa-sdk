// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Audit Explorer 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 인터페이스를 슬라이스 의존 표면으로 노출.
 * BFF 와 cross-domain query adapter 가 본 port 에 의존하고, infrastructure 가
 * 구현체를 주입한다.
 */
import type { LoggerPort, SliceLogContext } from "@qa-sdk/sim-domain-slice-kit";

export type AuditExplorerLoggerPort = LoggerPort;
export type AuditExplorerLogContext = SliceLogContext;
