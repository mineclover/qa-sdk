// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import type { LoggerPort, SliceLogContext } from '../logger.port.js';

/**
 * 본 어댑터가 의존하는 호스트 logger 의 최소 구조 (pino 호환).
 *
 * sim 환경의 services/<svc>/src/lib/logger.ts 의 `createLogger("sim-...")` 가
 * 반환하는 pino Logger 가 정확히 이 shape 를 만족한다.
 */
export interface HostLoggerLike {
  child(bindings: Record<string, unknown>): HostLoggerLike;
  info(obj: Record<string, unknown>, msg: string): void;
  info(msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  warn(msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  error(msg: string): void;
}

/**
 * 호스트 logger 를 LoggerPort 로 감싼다.
 *
 * - 모든 emit 시점에 SliceLogContext 의 표준 필드를 logger.child(ctx) 로 강제
 * - error 의 경우 err 키 (CLAUDE.md 컨벤션) 를 그대로 전달
 *
 * 호출자는 createLogger("sim-pm-api.assignment") 같은 하위 namespace 를
 * 미리 만들어 주입한다. 본 어댑터는 namespace 를 모른다 (관심사 분리).
 */
export function createDefaultLoggerAdapter(host: HostLoggerLike): LoggerPort {
  return {
    info(ctx: SliceLogContext, message: string): void {
      host.child(ctxToBindings(ctx)).info(message);
    },
    warn(ctx: SliceLogContext, message: string): void {
      host.child(ctxToBindings(ctx)).warn(message);
    },
    error(ctx: SliceLogContext & { err: unknown }, message: string): void {
      const { err, ...rest } = ctx;
      host.child(ctxToBindings(rest)).error({ err }, message);
    },
  };
}

function ctxToBindings(ctx: SliceLogContext): Record<string, unknown> {
  // undefined 필드는 pino 에 노출하지 않도록 정리.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
