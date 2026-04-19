// @def.boundary registry-system
// @def.doc registry-system

import { Global, Module } from "@nestjs/common";
import {
  SqlPrefixRegistry,
  SqlVersionLifecycleStore,
  type SqlDriver,
} from "index-meta";
import { DATABASE } from "./database.module.js";
import { RegistryService } from "./lib/registry-service.js";
import { SqlDraftLockStore } from "./stores/sql-draft-lock-store.js";
import { SqlPrefixOwnerStore } from "./stores/sql-prefix-owner-store.js";

/** 공유 DI 토큰 — RegistryService 의존 store 4종 + base RegistryService */
export const PREFIX_REGISTRY = "PREFIX_REGISTRY";
export const VERSION_STORE = "VERSION_STORE";
export const OWNER_STORE = "OWNER_STORE";
export const LOCK_STORE = "LOCK_STORE";
export const REGISTRY_SERVICE = "REGISTRY_SERVICE";

/**
 * RegistryService 핵심 store를 싱글턴으로 제공하는 글로벌 모듈.
 *
 * - 4개 store는 한 번만 생성되어 전체 서비스에서 공유
 * - REGISTRY_SERVICE는 gate/hook 없는 base 인스턴스 (VersionModule만 자체 구성)
 */
@Global()
@Module({
  providers: [
    {
      provide: PREFIX_REGISTRY,
      useFactory: (db: SqlDriver) => new SqlPrefixRegistry(db),
      inject: [DATABASE],
    },
    {
      provide: VERSION_STORE,
      useFactory: (db: SqlDriver) => new SqlVersionLifecycleStore(db),
      inject: [DATABASE],
    },
    {
      provide: OWNER_STORE,
      useFactory: (db: SqlDriver) => new SqlPrefixOwnerStore(db),
      inject: [DATABASE],
    },
    {
      provide: LOCK_STORE,
      useFactory: (db: SqlDriver) => new SqlDraftLockStore(db),
      inject: [DATABASE],
    },
    {
      provide: REGISTRY_SERVICE,
      useFactory: (
        prefixRegistry: SqlPrefixRegistry,
        versionStore: SqlVersionLifecycleStore,
        ownerStore: SqlPrefixOwnerStore,
        lockStore: SqlDraftLockStore,
      ) =>
        new RegistryService({
          prefixRegistry,
          versionStore,
          ownerStore,
          lockStore,
        }),
      inject: [PREFIX_REGISTRY, VERSION_STORE, OWNER_STORE, LOCK_STORE],
    },
  ],
  exports: [
    PREFIX_REGISTRY,
    VERSION_STORE,
    OWNER_STORE,
    LOCK_STORE,
    REGISTRY_SERVICE,
  ],
})
export class RegistryCoreModule {}
