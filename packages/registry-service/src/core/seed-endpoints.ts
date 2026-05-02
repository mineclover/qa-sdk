// @def.boundary registry-system
// @def.doc registry-system

import type { ServiceEndpointStore } from "../stores/service-endpoint-store.js";
import type { SeedLogger } from "./types.js";

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

/** 서비스 엔드포인트 seed — dev 환경은 SERVICE_PORTS에서 파생 */
export async function seedEndpoints(store: ServiceEndpointStore, logger: SeedLogger = noopLogger) {
  const { SERVICE_PORTS } = await import("@qa-sdk/core");
  const now = new Date().toISOString();

  // dev/asia — SERVICE_PORTS에서 자동 파생
  const devEndpoints = SERVICE_PORTS.map(entry => ({
    catalogId: "demo", namespace: "shop", svcName: entry.name,
    env: "dev", region: "asia", url: `http://localhost:${entry.defaultPort}`,
  }));
  // SERVICE_PORTS에 없는 dev 서비스 (platform-demo-api 등)
  const extraDevEndpoints = [
    { catalogId: "demo", namespace: "shop", svcName: "platform-demo-api", env: "dev", region: "asia", url: "http://localhost:8787" },
    { catalogId: "demo", namespace: "shop", svcName: "prometheus",        env: "dev", region: "asia", url: "http://localhost:9090" },
    { catalogId: "demo", namespace: "shop", svcName: "grafana",           env: "dev", region: "asia", url: "http://localhost:3000" },
  ];
  const endpoints = [...devEndpoints, ...extraDevEndpoints,
    // prod/asia — Cloudflare Pages
    { catalogId: "demo", namespace: "shop", svcName: "shopping-web",      env: "prod", region: "asia", url: "https://shop-web-7dq.pages.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "platform-demo",     env: "prod", region: "asia", url: "https://platform-demo-3v1.pages.dev" },
    // prod/asia — Cloudflare Workers
    { catalogId: "demo", namespace: "shop", svcName: "registry-service",  env: "prod", region: "asia", url: "https://qa-registry-service.astralclover.workers.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "gate-service",      env: "prod", region: "asia", url: "https://qa-gate-service.astralclover.workers.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "query-service",     env: "prod", region: "asia", url: "https://qa-query-service.astralclover.workers.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "decode-service",    env: "prod", region: "asia", url: "https://qa-decode-service.astralclover.workers.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "platform-demo-api", env: "prod", region: "asia", url: "https://platform-demo-api.astralclover.workers.dev" },
    { catalogId: "demo", namespace: "shop", svcName: "gateway",           env: "prod", region: "asia", url: "https://qa-gateway.astralclover.workers.dev" },
  ];

  for (const ep of endpoints) {
    await store.upsert({ ...ep, updatedAt: now });
  }
  logger.info({ count: endpoints.length }, "seeded service endpoints");
}
