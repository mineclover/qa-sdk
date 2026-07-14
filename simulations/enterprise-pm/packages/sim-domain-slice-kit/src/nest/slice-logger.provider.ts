// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { Inject, type Provider } from '@nestjs/common';
import type { LoggerPort } from '../logger.port.js';
import { createDefaultLoggerAdapter, type HostLoggerLike } from '../logger/default.js';

/**
 * NestJS DI 토큰 — LoggerPort 인스턴스를 주입한다.
 *
 * 슬라이스 모듈은 `@Inject(SLICE_LOGGER_PORT)` 로 LoggerPort 를 주입받고,
 * 서비스 부트스트랩 (예: PmAppModule) 은 호스트 logger 를 어댑터로 감싸
 * 토큰에 바인딩한다.
 */
export const SLICE_LOGGER_PORT = Symbol.for('sim-domain-slice-kit/LoggerPort');

/** 보일러플레이트 단축용 — `@InjectSliceLogger() private readonly logger: LoggerPort`. */
export const InjectSliceLogger = (): ReturnType<typeof Inject> => Inject(SLICE_LOGGER_PORT);

/**
 * 호스트 logger 를 LoggerPort 로 감싸 토큰에 바인딩하는 Nest provider 팩토리.
 *
 * @example
 *   {
 *     module: PmAppModule,
 *     providers: [createSliceLoggerProvider(() => createLogger("sim-pm-api"))],
 *     exports: [SLICE_LOGGER_PORT],
 *   }
 */
export function createSliceLoggerProvider(hostFactory: () => HostLoggerLike): Provider {
  return {
    provide: SLICE_LOGGER_PORT,
    useFactory: (): LoggerPort => createDefaultLoggerAdapter(hostFactory()),
  };
}
