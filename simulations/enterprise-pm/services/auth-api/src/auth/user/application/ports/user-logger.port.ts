// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * User 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 를 슬라이스 의존 표면으로 노출.
 */
import type { LoggerPort, SliceLogContext } from '@qa-sdk/sim-domain-slice-kit';

export type UserLoggerPort = LoggerPort;
export type UserLogContext = SliceLogContext;
