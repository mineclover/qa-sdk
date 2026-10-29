// @def.boundary registry-system
// @def.doc registry-system

/**
 * e2e 공용 — 테스트마다 독립된 AppModule 인스턴스(sqlite :memory:)를 띄우고 HTTP 호환 래퍼와
 * 앱이 실제로 쓰는 store·RegistryService를 함께 돌려준다. HTTP와 라이브러리 경로가 같은 상태를 본다.
 * 띄운 앱은 closeRegistryApps()로 정리한다 (afterEach).
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PrefixRegistry, VersionLifecycleStore } from 'index-meta';
import { AppModule } from '../app.module.js';
import type { RegistryService } from '../lib/registry-service.js';
import {
  LOCK_STORE,
  OWNER_STORE,
  PREFIX_REGISTRY,
  REGISTRY_SERVICE,
  VERSION_STORE,
} from '../registry-core.module.js';
import type { DraftLockStore } from '../stores/draft-lock-store.js';
import type { PrefixOwnerStore } from '../stores/prefix-owner-store.js';
import {
  createNestTestApp,
  wrapNestApp,
  type CompatApp,
  type CompatResponse,
} from '../test/nest-helpers.js';

export type { CompatApp, CompatResponse };

const openApps: NestFastifyApplication[] = [];

export interface RegistryTestApp {
  app: CompatApp;
  service: RegistryService;
  prefixRegistry: PrefixRegistry;
  versionStore: VersionLifecycleStore;
  ownerStore: PrefixOwnerStore;
  lockStore: DraftLockStore;
}

export async function buildRegistryApp(): Promise<RegistryTestApp> {
  const nestApp = await createNestTestApp({ imports: [AppModule] });
  openApps.push(nestApp);
  return {
    app: wrapNestApp(nestApp),
    service: nestApp.get(REGISTRY_SERVICE),
    prefixRegistry: nestApp.get(PREFIX_REGISTRY),
    versionStore: nestApp.get(VERSION_STORE),
    ownerStore: nestApp.get(OWNER_STORE),
    lockStore: nestApp.get(LOCK_STORE),
  };
}

export async function closeRegistryApps(): Promise<void> {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
}

/** 응답 본문 — e2e 단언은 구조를 그때그때 확인하므로 느슨하게 받는다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- e2e 본문 단언용
export async function json(res: CompatResponse): Promise<any> {
  return res.json();
}

export async function post(app: CompatApp, path: string, body?: object) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
