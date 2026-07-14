// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { SERVICE_VERSION } from './service-version.js';

/**
 * 응답 객체의 헤더 설정 메서드 추상.
 *
 * Fastify reply는 `header(name, value)`, Node http response는 `setHeader(name, value)`.
 * `fastify` 패키지를 직접 의존하지 않고 structural type으로 대응한다.
 */
interface HeaderSettingResponse {
  header?: (name: string, value: string) => unknown;
  setHeader?: (name: string, value: string) => unknown;
}

/**
 * 모든 HTTP 응답에 x-service-version 헤더를 첨부한다.
 *
 * spec 02-canary-topology.md §4.1 — "모든 응답 헤더 ... 에
 * serviceVersion: SIM_SERVICE_VERSION 을 첨부한다".
 *
 * 헤더 이름은 03-identifier-grammar §service-version header(grammar #5,
 * Plan A Task 2.5) 결과 `x-service-version` 와 일치 (hot path 성능 위해
 * 컴파일 상수로 박음). approval-api는 Fastify adapter 단일 (main.ts 참조).
 */
@Injectable()
export class VersionStampInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const reply = ctx.switchToHttp().getResponse<HeaderSettingResponse>();
        // Fastify reply는 header(), Node http response는 setHeader().
        if (typeof reply.header === 'function') {
          reply.header('x-service-version', SERVICE_VERSION);
        } else if (typeof reply.setHeader === 'function') {
          reply.setHeader('x-service-version', SERVICE_VERSION);
        }
      }),
    );
  }
}
