// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Scope, type Provider } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

/**
 * Request scope 컨텍스트의 DI 토큰 — TransactionScope 가 아니라
 * 요청 단위 traceId 와 correlationId 를 보관한다.
 *
 * Nest 의 REQUEST scope 를 사용하므로 controller / use-case 에서
 * @Inject(REQUEST_TRACE_CONTEXT) 로 주입받는다.
 */
export const REQUEST_TRACE_CONTEXT = Symbol.for('sim-domain-slice-kit/RequestTraceContext');

export interface RequestTraceContext {
  readonly traceId: string;
  readonly correlationId?: string;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  traceId?: string;
  correlationId?: string;
}

@Injectable({ scope: Scope.REQUEST })
class RequestTraceContextHolder {
  readonly value: RequestTraceContext;

  constructor(@Inject(REQUEST) request: RequestLike) {
    const traceId = readHeader(request, 'x-trace-id') ?? request.traceId ?? randomUUID();
    const correlationId =
      readHeader(request, 'x-correlation-id') ?? request.correlationId ?? undefined;
    // 후속 필터/인터셉터가 활용할 수 있도록 request 에도 기록.
    request.traceId = traceId;
    if (correlationId) request.correlationId = correlationId;
    this.value = { traceId, correlationId };
  }
}

function readHeader(request: RequestLike, name: string): string | undefined {
  const v = request.headers?.[name];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

/**
 * Request scope provider — REQUEST_TRACE_CONTEXT 토큰에 RequestTraceContext 를
 * 바인딩한다.
 */
export const requestTraceContextProvider: Provider = {
  provide: REQUEST_TRACE_CONTEXT,
  scope: Scope.REQUEST,
  useFactory: (holder: RequestTraceContextHolder) => holder.value,
  inject: [RequestTraceContextHolder],
};

/** 보일러플레이트 단축 — module 의 providers 에 함께 등록한다. */
export const transactionScopeProviders: Provider[] = [
  RequestTraceContextHolder,
  requestTraceContextProvider,
];
