// @def.boundary registry-system
// @def.doc registry-system

export type { CatalogStore } from '../stores/catalog-store.js';
export type { ConfigStore } from '../stores/config-store.js';
export type { AxisProfileStore } from '../stores/axis-profile-store.js';
export type { ServiceEndpointStore } from '../stores/service-endpoint-store.js';
export type { EventSchemaStore } from '../stores/event-schema-store.js';
export type { PrefixOwnerStore } from '../stores/prefix-owner-store.js';
export type { DraftLockStore } from '../stores/draft-lock-store.js';

/** seed 함수에서 사용하는 최소 로거 인터페이스 */
export interface SeedLogger {
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  debug?(msg: string): void;
}
