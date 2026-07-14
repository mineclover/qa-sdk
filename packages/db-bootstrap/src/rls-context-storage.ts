// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { AsyncLocalStorage } from 'node:async_hooks';

import type { RlsSessionContext } from './rls-session.js';
import { EMPTY_RLS_CONTEXT } from './rls-session.js';

const storage = new AsyncLocalStorage<RlsSessionContext>();

/**
 * request 처리 콜백 동안 RlsSessionContext 를 binding.
 * interceptor 에서 요청 진입 시 호출, 내부 async 체인 어디서든 getCurrentRlsContext() 로 조회.
 */
export function withRlsContext<T>(ctx: RlsSessionContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * 현재 async 실행 스택의 RlsSessionContext.
 * interceptor 가 bind 하지 않은 경로에서는 EMPTY_RLS_CONTEXT 반환 — helper 는 NULL 로 처리해 default deny.
 */
export function getCurrentRlsContext(): RlsSessionContext {
  return storage.getStore() ?? EMPTY_RLS_CONTEXT;
}
