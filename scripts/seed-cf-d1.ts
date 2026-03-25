#!/usr/bin/env tsx
/**
 * seed-cf-d1.ts — CF Workers registry-service에 DEMO 데이터 seed.
 *
 * 사용: npx tsx scripts/seed-cf-d1.ts [base-url]
 * 기본 URL: https://qa-registry-service.astralclover.workers.dev
 */

import { DEMO_CATALOG } from "demo-snapshot";
import { DEMO_DKG_CONFIG } from "demo-snapshot";

const BASE = process.argv[2] ?? "https://qa-registry-service.astralclover.workers.dev";

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`${res.status} ${path} → ${text.slice(0, 120)}`);
  return res;
}

async function put(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`${res.status} ${path} → ${text.slice(0, 120)}`);
  return res;
}

async function main() {
  console.log(`\n═══ Seeding CF D1 via ${BASE} ═══\n`);

  // 1. Catalog 등록
  console.log("── 1. Catalog ──");
  await post("/catalogs", {
    id: "demo",
    name: "쇼핑 데모",
    data: JSON.stringify(DEMO_CATALOG),
  });

  // 2. DkgConfig
  console.log("\n── 2. DkgConfig ──");
  await put("/catalogs/demo/config", {
    data: JSON.stringify(DEMO_DKG_CONFIG),
  });

  // 3. 서비스 목록
  console.log("\n── 3. Services ──");
  const services = [
    { serviceId: "shopping-web", name: "쇼핑 웹", tier: "frontend", team: "frontend", url: "http://localhost:5220",
      ownedPrefixes: ["page_view", "tracking", "cart_event", "auth_event"], consumedPrefixes: ["service", "permission"] },
    { serviceId: "platform-demo", name: "플랫폼 데모", tier: "frontend", team: "frontend", url: "http://localhost:5176",
      ownedPrefixes: [], consumedPrefixes: ["service", "page_view", "tracking", "endpoint", "flow_point", "order_event"] },
    { serviceId: "shopping-backend", name: "쇼핑 백엔드", tier: "backend", team: "backend",
      ownedPrefixes: ["order_event", "endpoint", "event"], consumedPrefixes: ["service", "permission", "cart_event"] },
    { serviceId: "auth", name: "인증 서비스", tier: "backend", team: "platform",
      ownedPrefixes: ["rbac", "auth_event"], consumedPrefixes: ["service"] },
    { serviceId: "payment", name: "결제 서비스", tier: "backend", team: "backend",
      ownedPrefixes: ["flow_point", "permission"], consumedPrefixes: ["service", "order_event"] },
    { serviceId: "gateway", name: "API 게이트웨이", tier: "backend", team: "platform",
      ownedPrefixes: ["endpoint", "schema_validation"], consumedPrefixes: ["service", "rbac"] },
    { serviceId: "infra-controller", name: "인프라 컨트롤러", tier: "infra", team: "devops", url: "http://localhost:3300",
      ownedPrefixes: ["deploy_event", "health_event", "service", "data_policy", "engine_event", "schema_event"] },
    { serviceId: "ingest-server", name: "이벤트 수집", tier: "infra", team: "platform", url: "http://localhost:3200",
      // 파이프라인 자체 이벤트만 생산 — 나머지(ingest_record 등)는 소비/저장 대상
      ownedPrefixes: ["pipeline_point"],
      consumedPrefixes: ["service"] },
    { serviceId: "registry-service", name: "레지스트리 서비스", tier: "infra", team: "platform", url: "http://localhost:3300",
      // 메타데이터 관리 전용 — 이벤트 생산 없음
      ownedPrefixes: [], consumedPrefixes: ["service"] },
    { serviceId: "qa-sdk-cli", name: "QA SDK CLI", tier: "system", team: "platform",
      // skill_execution, cli_tracking — 후속 구현 예정
      ownedPrefixes: ["cli_event"], consumedPrefixes: ["service", "dkg_event"] },
    { serviceId: "dkg-engine", name: "DKG 엔진", tier: "system", team: "platform",
      ownedPrefixes: ["dkg_event", "dkg_decision_event", "dkg_observation_event", "observation_event", "spec_event", "edge_activity"],
      consumedPrefixes: ["service", "build_event", "test_event"] },
    { serviceId: "gate-service", name: "게이트 서비스", tier: "infra", team: "platform", url: "http://localhost:3400",
      // 읽기 전용 게이트 상태 캐시 — gate_point는 GateEngine 라이브러리가 계산
      ownedPrefixes: [], consumedPrefixes: ["service", "version_point"] },
    { serviceId: "query-service", name: "쿼리 서비스", tier: "infra", team: "platform", url: "http://localhost:3500",
      ownedPrefixes: [], consumedPrefixes: ["service", "gate_point", "endpoint"] },
    { serviceId: "decode-service", name: "디코드 서비스", tier: "infra", team: "platform", url: "http://localhost:3600",
      ownedPrefixes: [], consumedPrefixes: ["service"] },
    { serviceId: "content-service", name: "콘텐츠 서비스", tier: "backend", team: "frontend",
      ownedPrefixes: ["content"], consumedPrefixes: ["service", "tracking"] },
    { serviceId: "platform-demo-api", name: "플랫폼 데모 API", tier: "backend", team: "frontend", url: "http://localhost:5176",
      ownedPrefixes: [], consumedPrefixes: ["service", "page_view", "endpoint"] },
  ];
  await put("/api/services", { services });

  // 4. Endpoints
  console.log("\n── 4. Endpoints ──");
  const endpoints = [
    // dev/asia — 백엔드 (3xxx/4xxx)
    { namespace: "shop", svcName: "ingest-server",   env: "dev", region: "asia", url: "http://localhost:3200" },
    { namespace: "shop", svcName: "registry-service", env: "dev", region: "asia", url: "http://localhost:3300" },
    { namespace: "shop", svcName: "shopping-backend", env: "dev", region: "asia", url: "http://localhost:3201" },
    { namespace: "shop", svcName: "auth",             env: "dev", region: "asia", url: "http://localhost:4200" },
    { namespace: "shop", svcName: "payment",          env: "dev", region: "asia", url: "http://localhost:4300" },
    { namespace: "shop", svcName: "gateway",          env: "dev", region: "asia", url: "http://localhost:4400" },
    // dev/asia — 프론트엔드 (5xxx)
    { namespace: "shop", svcName: "shopping-web",     env: "dev", region: "asia", url: "http://localhost:5220" },
    { namespace: "shop", svcName: "platform-demo",    env: "dev", region: "asia", url: "http://localhost:5176" },
    { namespace: "shop", svcName: "gate-service",     env: "dev", region: "asia", url: "http://localhost:3400" },
    { namespace: "shop", svcName: "query-service",    env: "dev", region: "asia", url: "http://localhost:3500" },
    { namespace: "shop", svcName: "decode-service",   env: "dev", region: "asia", url: "http://localhost:3600" },
    // prod/asia — CF URLs
    { namespace: "shop", svcName: "registry-service", env: "prod", region: "asia", url: "https://qa-registry-service.astralclover.workers.dev" },
    { namespace: "shop", svcName: "platform-demo",    env: "prod", region: "asia", url: "https://platform-demo.pages.dev" },
  ];
  for (const ep of endpoints) {
    await put(`/api/endpoints/${ep.namespace}/${ep.svcName}/${ep.env}/${ep.region}`, {
      url: ep.url,
      catalogId: "demo",
    });
  }

  // 5. 검증
  console.log("\n── 5. 검증 ──");
  const catalogs = await fetch(`${BASE}/catalogs`).then(r => r.json());
  console.log(`catalogs: ${JSON.stringify(catalogs).slice(0, 100)}`);

  const svcs = await fetch(`${BASE}/api/services`).then(r => r.json());
  console.log(`services: ${(svcs as any[]).length}개`);

  const eps = await fetch(`${BASE}/api/endpoints`).then(r => r.json());
  console.log(`endpoints: ${(eps as any[]).length}개`);

  const resolve = await fetch(`${BASE}/api/endpoints/resolve?namespace=shop&name=registry-service&env=prod&region=asia`).then(r => r.json());
  console.log(`resolve registry-service prod: ${JSON.stringify(resolve)}`);

  console.log("\n✅ Seed 완료");
}

main().catch(console.error);
