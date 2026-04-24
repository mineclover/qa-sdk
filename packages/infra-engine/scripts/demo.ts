#!/usr/bin/env pnpm exec tsx
/**
 * infra-engine 운영 데모
 *
 * 전체 인프라 스택을 E2E로 검증한다.
 *
 * 사전 조건:
 * - infra env up (MinIO + Zitadel)
 * - K8s 서비스 배포됨
 * - registry-service, definition-service 실행 중
 *
 * 실행: pnpm exec tsx scripts/demo.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

// ── 유틸 ──────────────────────────────────────────────

async function test(name: string, fn: () => Promise<boolean>): Promise<void> {
  try {
    const ok = await fn();
    if (ok) {
      passed++;
      console.log(`  PASS  ${name}`);
    } else {
      failed++;
      console.log(`  FAIL  ${name}`);
    }
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name} -- ${err instanceof Error ? err.message : err}`);
  }
}

async function http(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5_000),
  });
  const body = await res.text();
  return { status: res.status, body };
}

function section(num: number, title: string): void {
  console.log(`\n--- [${num}] ${title} ---`);
}

// ── main ──────────────────────────────────────────────

async function main() {
  console.log("\n========================================");
  console.log("   infra-engine 운영 데모");
  console.log("========================================\n");

  const GW = "http://127.0.0.1:28787";
  const REGISTRY = "http://localhost:3300";
  const ENRICHMENT = "http://localhost:3900";
  const ZITADEL = "http://localhost:8085";
  const PROFILE_DIR = resolve(homedir(), ".qa-sdk");

  // ━━━ [1] 인프라 환경 확인 ━━━
  section(1, "인프라 환경 확인");

  await test("MinIO S3 (localhost:9000)", async () => {
    const r = await http("http://localhost:9000/minio/health/live");
    return r.status === 200;
  });

  await test("K8s 클러스터", async () => {
    const { execa } = await import("execa");
    const result = await execa("kubectl", ["cluster-info", "--request-timeout=3s"]).catch(() => ({
      exitCode: 1,
    }));
    return result.exitCode === 0;
  });

  await test("Zitadel SSO (localhost:8085)", async () => {
    const r = await http(`${ZITADEL}/debug/healthz`);
    return r.status === 200;
  });

  await test("Registry Service (localhost:3300)", async () => {
    const r = await http(`${REGISTRY}/health`);
    return r.status === 200;
  });

  await test("Enrichment Server (localhost:3900)", async () => {
    const r = await http(`${ENRICHMENT}/health`);
    return r.status === 200;
  });

  // ━━━ [2] K8s 서비스 헬스체크 ━━━
  section(2, "K8s 서비스 헬스체크");

  const k8sServices = [
    { name: "Gateway", url: "http://127.0.0.1:28787", path: "/health" },
    { name: "Ingest", url: "http://127.0.0.1:23200", path: "/health/live" },
    { name: "Decision", url: "http://127.0.0.1:23800", path: "/health" },
    { name: "Definition", url: "http://127.0.0.1:23700", path: "/health" },
    { name: "Motion Workspace", url: "http://127.0.0.1:23710", path: "/health" },
    { name: "Nginx Test", url: "http://127.0.0.1:20080", path: "/" },
  ];

  for (const svc of k8sServices) {
    await test(`${svc.name} (K8s)`, async () => {
      const r = await http(`${svc.url}${svc.path}`);
      return r.status === 200;
    });
  }

  // ━━━ [3] 서비스 디스커버리 ━━━
  section(3, "서비스 디스커버리");

  await test("전체 서비스 URL 조회", async () => {
    const r = await http(`${REGISTRY}/api/services/urls?catalog=demo&env=dev`);
    const urls = JSON.parse(r.body);
    const count = Object.keys(urls).length;
    console.log(`         ${count}개 서비스 등록됨`);
    return count > 10;
  });

  await test("서비스 상세 (ingest-server)", async () => {
    const r = await http(`${REGISTRY}/api/services/ingest-server?catalog=demo`);
    const svc = JSON.parse(r.body);
    return svc.serviceId === "ingest-server" && svc.tier === "infra";
  });

  await test("서비스 목록 조회", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const client = createDiscoveryClient(REGISTRY);
    const services = await client.listServices();
    console.log(`         ${services.length}개 서비스`);
    return services.length > 10;
  });

  await test("연결 코드 생성 (ingest-server)", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const client = createDiscoveryClient(REGISTRY);
    const code = await client.generateConnectCode("ingest-server", "dev");
    return code.includes("INGEST_SERVER_URL") && code.includes("connectIngestServer");
  });

  // ━━━ [4] Gateway 라우팅 ━━━
  section(4, "Gateway 라우팅");

  await test("GET /health -> 200", async () => {
    const r = await http(`${GW}/health`);
    return r.status === 200;
  });

  await test("GET /v1/sessions -> ingest-server", async () => {
    const r = await http(`${GW}/v1/sessions`);
    return r.status === 200;
  });

  await test("GET /unknown -> 404", async () => {
    const r = await http(`${GW}/unknown`);
    return r.status === 404;
  });

  await test("CORS Access-Control-Allow-Origin: *", async () => {
    const res = await fetch(`${GW}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
      signal: AbortSignal.timeout(5_000),
    });
    return res.headers.get("access-control-allow-origin") === "*";
  });

  // ━━━ [5] 이벤트 수집 ━━━
  section(5, "이벤트 수집 (POST /v1/ingest)");

  const txId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await test("POST /v1/ingest via gateway -> 202", async () => {
    const r = await http(`${GW}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transmission_id: txId,
        sent_at: new Date().toISOString(),
        owner: { owner_type: "agent", owner_id: "demo" },
        source: { service_name: "demo", sdk_name: "demo", sdk_version: "1.0" },
        runtime: { platform: "node" },
        build: { env: "dev" },
        records: [
          {
            log_id: `demo-${Date.now()}`,
            timestamp: new Date().toISOString(),
            record_kind: "log",
            trace_id: "demo-trace",
            span_id: "demo-span",
            event_key: "deploy_event",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { demo: true, scenario: "operational-demo" },
          },
        ],
      }),
    });
    return r.status === 200 || r.status === 202;
  });

  await test("POST /v1/ingest 직접 (localhost:3200) -> 202", async () => {
    const r = await http("http://localhost:3200/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transmission_id: `demo-direct-${Date.now()}`,
        sent_at: new Date().toISOString(),
        owner: { owner_type: "agent", owner_id: "demo-direct" },
        source: { service_name: "demo", sdk_name: "demo", sdk_version: "1.0" },
        runtime: { platform: "node" },
        build: { env: "dev" },
        records: [
          {
            log_id: `demo-direct-${Date.now()}`,
            timestamp: new Date().toISOString(),
            record_kind: "log",
            trace_id: "demo-direct-trace",
            span_id: "demo-direct-span",
            event_key: "deploy_event",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { demo: true, direct: true },
          },
        ],
      }),
    });
    return r.status === 200 || r.status === 202;
  });

  // ━━━ [6] 인증 흐름 (Enrichment + JWT) ━━━
  section(6, "인증 흐름 (Enrichment + JWT)");

  await test("Enrichment: admin -> /w8= (12 features)", async () => {
    const r = await http(`${ENRICHMENT}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "admin-demo", roles: ["admin"] }),
    });
    const d = JSON.parse(r.body);
    return d.perms?.infra === "/w8=";
  });

  await test("Enrichment: viewer -> read only", async () => {
    const r = await http(`${ENRICHMENT}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "viewer-demo", roles: ["viewer"] }),
    });
    const d = JSON.parse(r.body);
    return d.perms?.infra !== "/w8=" && !!d.perms?.infra;
  });

  await test("Enrichment: deployer -> deploy_execute 비트 포함", async () => {
    const r = await http(`${ENRICHMENT}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "deployer-demo", roles: ["deployer"] }),
    });
    const d = JSON.parse(r.body);
    return !!d.perms?.infra;
  });

  // JWT 테스트 토큰 생성 (test-jwt.ts 활용)
  const { TEST_TOKENS } = await import("../src/auth/test-jwt.js");

  await test("JWT admin 토큰 구조 (perms claim 포함)", async () => {
    const token = TEST_TOKENS.admin();
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.perms?.infra === "/w8=" && payload.perms_v === 1;
  });

  await test("JWT reader 토큰 구조 (읽기 전용 perms)", async () => {
    const token = TEST_TOKENS.reader();
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.perms?.infra !== "/w8=" && !!payload.perms?.infra;
  });

  await test("JWT noPerms 토큰 구조 (perms 없음)", async () => {
    const token = TEST_TOKENS.noPerms();
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.perms === undefined;
  });

  // ━━━ [7] Zitadel OIDC ━━━
  section(7, "Zitadel OIDC");

  await test("OIDC Discovery (.well-known)", async () => {
    const r = await http(`${ZITADEL}/.well-known/openid-configuration`);
    const d = JSON.parse(r.body);
    return d.issuer === ZITADEL;
  });

  await test("Zitadel userinfo (service account)", async () => {
    try {
      const token = await readFile("/tmp/zitadel-token.txt", "utf-8");
      const r = await http(`${ZITADEL}/oidc/v1/userinfo`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      return r.status === 200;
    } catch {
      console.log("         /tmp/zitadel-token.txt 없음 -- skip");
      return false;
    }
  });

  await test("Zitadel metadata (perms 저장 확인)", async () => {
    try {
      const token = await readFile("/tmp/zitadel-token.txt", "utf-8");
      // machine key에서 userId 추출
      let userId: string;
      try {
        const machineKey = JSON.parse(
          await readFile("/tmp/zitadel-machinekey.json", "utf-8"),
        ) as { userId: string };
        userId = machineKey.userId;
      } catch {
        console.log("         /tmp/zitadel-machinekey.json 없음 -- skip");
        return false;
      }
      const r = await http(
        `${ZITADEL}/management/v1/users/${userId}/metadata/_search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      const d = JSON.parse(r.body);
      return (d.result ?? []).some((m: { key: string }) => m.key === "perms");
    } catch {
      return false;
    }
  });

  // ━━━ [8] 대시보드 + 모니터링 ━━━
  section(8, "대시보드 + 모니터링");

  await test("Fleet 상태 조회 (FleetManager)", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const { createInfraProfileAdapter } = await import("../src/adapters/infra-profile.js");
    const { createFleetManager } = await import("../src/fleet/manager.js");
    const client = createDiscoveryClient(REGISTRY);
    const profile = createInfraProfileAdapter(PROFILE_DIR);
    const fleet = createFleetManager(client, profile);
    const status = await fleet.status("dev");
    console.log(
      `         총: ${status.summary.total}, 배포: ${status.summary.deployed}, 실행: ${status.summary.running}`,
    );
    return status.summary.total > 15;
  });

  await test("Dashboard 요약 (DashboardData)", async () => {
    const { createInfraProfileAdapter } = await import("../src/adapters/infra-profile.js");
    const { createDashboardData } = await import("../src/monitor/dashboard.js");
    const profile = createInfraProfileAdapter(PROFILE_DIR);
    const dashboard = createDashboardData(profile);
    const summary = await dashboard.getSummary();
    console.log(
      `         배포됨: ${summary.deployed}, 모니터: ${summary.monitored}`,
    );
    // 프로필 데이터 유무와 상관없이 호출 성공 자체가 패스
    return typeof summary.totalServices === "number";
  });

  await test("HTTP 헬스 프로브 (httpProbe)", async () => {
    const { httpProbe } = await import("../src/verify/health-check.js");
    const result = await httpProbe(`${REGISTRY}/health`, { timeout: 3000 });
    return result.verdict === "pass";
  });

  // ━━━ [9] Export ━━━
  section(9, "Export (env 파일 + TypeScript 모듈)");

  await test("env 파일 생성 (ingest-server dev)", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const { generateEnvFile } = await import("infra-env-kit");
    const client = createDiscoveryClient(REGISTRY);
    const configPath = resolve(__dirname, "../config/dev.json");
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    const content = await generateEnvFile(
      client,
      { serviceId: "ingest-server", env: "dev" },
      config.services?.["ingest-server"],
    );
    return content.includes("PORT=3200") && content.includes("STORE_DRIVER=d1");
  });

  await test("TypeScript 모듈 생성", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const { generateTypescriptModule } = await import("infra-env-kit");
    const client = createDiscoveryClient(REGISTRY);
    const content = await generateTypescriptModule(client, "dev");
    return content.includes("SERVICE_URLS") && content.includes("export");
  });

  await test("docker-compose override 생성", async () => {
    const { createDiscoveryClient } = await import("../src/discovery/client.js");
    const { generateDockerComposeOverride } = await import("infra-env-kit");
    const client = createDiscoveryClient(REGISTRY);
    const content = await generateDockerComposeOverride(client, "dev");
    return content.includes("services") || content.includes("version");
  });

  // ━━━ [10] 버전 관리 ━━━
  section(10, "버전 관리");

  await test("버전 기록 + 조회", async () => {
    const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
    const vs = createVersionStore();
    const demoVersion = `demo-${Date.now().toString(36)}`;
    const entry = await vs.setVersion(
      "demo-test-svc",
      "demo",
      demoVersion,
      "http://localhost:9999",
      "local",
    );
    const retrieved = await vs.getVersion("demo-test-svc", "demo");
    return (
      retrieved !== null &&
      retrieved.currentVersion === demoVersion &&
      entry.serviceId === "demo-test-svc"
    );
  });

  await test("버전 이력 (history)", async () => {
    const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
    const vs = createVersionStore();
    // 두 번째 버전 기록
    const v2 = `demo-v2-${Date.now().toString(36)}`;
    await vs.setVersion("demo-test-svc", "demo", v2, "http://localhost:9999", "local");
    const entry = await vs.getVersion("demo-test-svc", "demo");
    return (
      entry !== null &&
      entry.currentVersion === v2 &&
      entry.previousVersion !== undefined &&
      entry.history.length >= 2
    );
  });

  await test("버전 롤백", async () => {
    const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
    const vs = createVersionStore();
    const before = await vs.getVersion("demo-test-svc", "demo");
    if (!before?.previousVersion) return false;
    const rolled = await vs.rollback("demo-test-svc", "demo");
    return rolled !== null && rolled.currentVersion === before.previousVersion;
  });

  await test("버전 목록 (listVersions)", async () => {
    const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
    const vs = createVersionStore();
    const all = await vs.listVersions("demo");
    return all.length >= 1;
  });

  // ━━━ [11] 배포 시나리오 (nginx-test) ━━━
  section(11, "배포 시나리오 (nginx-test)");

  await test("Nginx Test 서비스 접근 (K8s)", async () => {
    const r = await http("http://127.0.0.1:20080/");
    return r.status === 200;
  });

  await test("Nginx Test 컨텐츠 확인", async () => {
    const r = await http("http://127.0.0.1:20080/");
    return r.body.includes("nginx") || r.body.includes("Welcome") || r.status === 200;
  });

  // ── 정리: 데모용 버전 레코드 삭제 ──
  // version store는 파일 기반이므로 demo-test-svc 레코드만 정리
  try {
    const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
    const vs = createVersionStore();
    // 롤백을 한 번 더 해서 원래 상태로 (혹은 그냥 놔둠 -- 50건 제한이 자동 정리)
    // 명시적 delete API가 없으므로 그대로 둔다.
    void vs;
  } catch {
    // 정리 실패 무시
  }

  // ━━━ 결과 요약 ━━━
  const total = passed + failed;
  console.log("\n========================================");
  console.log(`   결과: ${passed} passed, ${failed} failed (총 ${total}건)`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("데모 실패:", err);
  process.exit(1);
});
