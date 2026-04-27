// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Assignment 슬라이스의 LoggerPort.
 *
 * sim-domain-slice-kit 의 LoggerPort 인터페이스를 슬라이스 의존 표면으로 노출.
 * Use-case 는 `AssignmentLoggerPort` 타입에 의존하고, infrastructure 가 구현체를
 * 주입한다. validator 는 use-case 파일에서 "LoggerPort" 토큰을 검출한다.
 */
import type { LoggerPort, SliceLogContext } from "@qa-sdk/sim-domain-slice-kit";

export type AssignmentLoggerPort = LoggerPort;
export type AssignmentLogContext = SliceLogContext;
