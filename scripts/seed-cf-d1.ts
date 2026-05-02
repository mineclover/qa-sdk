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
    // shopping-app
    { serviceId: "shopping-web", name: "쇼핑 웹", tier: "frontend", team: "frontend", url: "http://localhost:5220",
      applicationId: "shopping-app",
      attributes: { tierTag: "tier-frontend", concerns: ["observability"], environment: "production", criticality: "high" },
      ownedPrefixes: ["page_view", "tracking", "cart_event", "auth_event"], consumedPrefixes: ["service", "permission"] },
    { serviceId: "shopping-backend", name: "쇼핑 백엔드", tier: "backend", team: "backend",
      applicationId: "shopping-app",
      attributes: { tierTag: "tier-backend", concerns: ["security", "performance"], criticality: "high" },
      ownedPrefixes: ["order_event", "endpoint", "event"], consumedPrefixes: ["service", "permission", "cart_event"] },
    { serviceId: "content-service", name: "콘텐츠 서비스", tier: "backend", team: "frontend",
      applicationId: "shopping-app",
      attributes: { tierTag: "tier-backend", criticality: "medium" },
      ownedPrefixes: ["content"], consumedPrefixes: ["service", "tracking"] },
    // member-app
    { serviceId: "auth", name: "인증 서비스", tier: "backend", team: "platform",
      applicationId: "member-app",
      attributes: { tierTag: "tier-backend", concerns: ["security"], criticality: "critical" },
      ownedPrefixes: ["rbac", "auth_event"], consumedPrefixes: ["service"] },
    { serviceId: "payment", name: "결제 서비스", tier: "backend", team: "backend",
      applicationId: "member-app",
      attributes: { tierTag: "tier-backend", concerns: ["security", "performance"], criticality: "critical" },
      ownedPrefixes: ["flow_point", "permission"], consumedPrefixes: ["service", "order_event"] },
    { serviceId: "gateway", name: "API 게이트웨이", tier: "backend", team: "platform",
      applicationId: "member-app",
      attributes: { tierTag: "tier-backend", concerns: ["security", "performance"], structural: ["entry-point"], criticality: "critical" },
      ownedPrefixes: ["endpoint", "schema_validation"], consumedPrefixes: ["service", "rbac"] },
    // platform-app
    { serviceId: "ingest-server", name: "이벤트 수집", tier: "infra", team: "platform", url: "http://localhost:3200",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", concerns: ["observability", "performance"], structural: ["entry-point"], criticality: "critical" },
      ownedPrefixes: ["pipeline_point"], consumedPrefixes: ["service"] },
    { serviceId: "registry-service", name: "레지스트리 서비스", tier: "infra", team: "platform", url: "http://localhost:3300",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", concerns: ["observability"], structural: ["entry-point"], criticality: "critical" },
      ownedPrefixes: [], consumedPrefixes: ["service"] },
    { serviceId: "gate-service", name: "게이트 서비스", tier: "infra", team: "platform", url: "http://localhost:3400",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", criticality: "high" },
      ownedPrefixes: [], consumedPrefixes: ["service", "version_point", "decision_event", "decision_path", "escalation_event", "model_apply", "forcing_response"] },
    { serviceId: "query-service", name: "쿼리 서비스", tier: "infra", team: "platform", url: "http://localhost:3500",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", criticality: "high" },
      ownedPrefixes: [], consumedPrefixes: ["service", "gate_point", "endpoint"] },
    { serviceId: "decode-service", name: "디코드 서비스", tier: "infra", team: "platform", url: "http://localhost:3600",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", criticality: "medium" },
      ownedPrefixes: [], consumedPrefixes: ["service"] },
    { serviceId: "infra-controller", name: "인프라 컨트롤러", tier: "infra", team: "devops", url: "http://localhost:3300",
      applicationId: "platform-app",
      attributes: { tierTag: "tier-infra", concerns: ["observability"], criticality: "high" },
      ownedPrefixes: ["deploy_event", "health_event", "service", "data_policy", "engine_event", "schema_event"] },
    // devtools-app
    { serviceId: "qa-sdk-cli", name: "QA SDK CLI", tier: "system", team: "platform",
      applicationId: "devtools-app",
      attributes: { tierTag: "tier-system", concerns: ["observability", "testing"], criticality: "medium" },
      ownedPrefixes: ["cli_event"], consumedPrefixes: ["service", "dkg_event"] },
    { serviceId: "dkg-engine", name: "DKG 엔진", tier: "system", team: "platform",
      applicationId: "devtools-app",
      attributes: { tierTag: "tier-system", concerns: ["observability"], criticality: "medium" },
      ownedPrefixes: ["dkg_event", "dkg_decision_event", "dkg_observation_event", "observation_event", "spec_event", "edge_activity"],
      consumedPrefixes: ["service", "build_event", "test_event"] },
    // demo-app
    { serviceId: "platform-demo", name: "플랫폼 데모", tier: "frontend", team: "frontend", url: "http://localhost:5176",
      applicationId: "demo-app",
      attributes: { tierTag: "tier-frontend", criticality: "low" },
      ownedPrefixes: [], consumedPrefixes: ["service", "page_view", "tracking", "endpoint", "flow_point", "order_event"] },
    { serviceId: "platform-demo-api", name: "플랫폼 데모 API", tier: "backend", team: "frontend", url: "http://localhost:5176",
      applicationId: "demo-app",
      attributes: { tierTag: "tier-backend", criticality: "low" },
      ownedPrefixes: [], consumedPrefixes: ["service", "page_view", "endpoint"] },
  ];
  await put("/api/services", { services });

  // 3-1. Applications
  console.log("\n── 3-1. Applications ──");
  const applications = [
    { applicationId: "shopping-app", name: "쇼핑", description: "쇼핑 비즈니스 — 상품 탐색, 장바구니, 주문",
      serviceIds: ["shopping-web", "shopping-backend", "content-service"],
      criticality: "high", owner: { team: "commerce" } },
    { applicationId: "member-app", name: "회원 관리", description: "인증, 결제, API 게이트웨이",
      serviceIds: ["auth", "payment", "gateway"],
      criticality: "critical", owner: { team: "platform" } },
    { applicationId: "platform-app", name: "플랫폼 인프라", description: "수집, 레지스트리, 게이트, 쿼리, 디코드, 인프라 관리",
      serviceIds: ["ingest-server", "registry-service", "gate-service", "query-service", "decode-service", "infra-controller"],
      criticality: "critical", owner: { team: "platform" } },
    { applicationId: "devtools-app", name: "개발 도구", description: "CLI, DKG 엔진",
      serviceIds: ["qa-sdk-cli", "dkg-engine"],
      criticality: "medium", owner: { team: "platform" } },
    { applicationId: "demo-app", name: "데모", description: "플랫폼 데모 + 시각화",
      serviceIds: ["platform-demo", "platform-demo-api"],
      criticality: "low", owner: { team: "frontend" } },
  ];
  await put("/api/applications", { applications });

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
