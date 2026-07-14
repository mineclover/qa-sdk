// Generated from Catalog "demo" (hash: 9bf649aab9a4) at 2026-06-03T23:14:15
// !! 자동 생성 파일 — 직접 수정 금지 !!

import type { QaContext } from '@qa-sdk/context';
import type { ServiceBootConfig } from '@qa-sdk/core';
import type { PrefixId } from './prefix-ids.js';

/** Catalog "demo" 기반 타입 안전 QaContext. prefix 자동완성 제공. */
export type TypedQaContext = QaContext<PrefixId>;

/**
 * Catalog "demo" 기반 ServiceBootConfig.
 * env/region/name/namespace가 실제 축 엔트리로 제한되어 컴파일 타임 검증 가능.
 */
export interface TypedServiceBootConfig extends Omit<
  ServiceBootConfig,
  'env' | 'region' | 'name' | 'namespace'
> {
  readonly env: 'dev' | 'stage' | 'prod' | 'test' | 'local';
  readonly region: 'asia' | 'usa';
  readonly name:
    | 'shopping-web'
    | 'shopping-backend'
    | 'auth'
    | 'payment'
    | 'gateway'
    | 'registry-service'
    | 'ingest-server'
    | 'platform-demo'
    | 'content-service'
    | 'infra-controller'
    | 'gate-service'
    | 'query-service'
    | 'decode-service'
    | 'platform-demo-api'
    | 'roleplay-web'
    | 'viteplus-sdk-smoke';
  readonly namespace: 'shop' | 'cms';
}
