// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// commands/env-manager.ts — 로컬 인프라 환경 관리 (MinIO S3 + K8s)

import { resolve } from "node:path";

const COMPOSE_FILE = "docker-compose.infra.yaml";
const MINIO_ENDPOINT = "http://localhost:9000";
const MINIO_CONSOLE = "http://localhost:9001";

export async function envUp(cwd: string): Promise<void> {
  const { execa } = await import("execa");

  // secrets 확인 + .env.docker 생성
  const { ensureSecrets, generateDockerEnv } = await import("./secrets-manager.js");
  const secrets = await ensureSecrets();
  const envDockerPath = resolve(cwd, ".env.docker");
  await generateDockerEnv(secrets, envDockerPath);
  console.log("[env] .env.docker 생성됨");

  console.log("[env] MinIO S3 시작...");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { cwd, stdio: "inherit" });

  // MinIO 헬스체크 대기
  console.log("[env] 초기화 대기 중...");
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${MINIO_ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log("[env] MinIO 준비 완료");
        console.log(`[env] S3 endpoint: ${MINIO_ENDPOINT}`);
        console.log(`[env] Console: ${MINIO_CONSOLE} (credentials in .env.docker)`);
        break;
      }
    } catch {
      /* 아직 준비 안 됨 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // k3d 클러스터 확인
  try {
    await execa("kubectl", ["cluster-info", "--request-timeout=3s"]);
    console.log("[env] K8s 클러스터 연결 확인");
  } catch {
    console.log("[env] ⚠ K8s 클러스터 미실행 — 'k3d cluster create qa-local' 필요");
  }
}

export async function envDown(cwd: string): Promise<void> {
  const { execa } = await import("execa");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "down"], { cwd, stdio: "inherit" });
  console.log("[env] MinIO 종료");
}

export async function envStatus(): Promise<void> {
  console.log("\n=== 인프라 환경 상태 ===\n");

  let config: Awaited<ReturnType<typeof import("./config-manager.js").loadInfraConfig>> | undefined;
  try {
    const { loadInfraConfig } = await import("./config-manager.js");
    config = await loadInfraConfig();
  } catch {
    /* config 조회 실패는 fallback 사용 */
  }

  let minioRunning = false;

  // MinIO
  try {
    const res = await fetch(`${MINIO_ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      minioRunning = true;
      console.log("  MinIO S3:    🟢 실행 중");
      console.log(`    endpoint: ${MINIO_ENDPOINT}`);
      console.log(`    console:  ${MINIO_CONSOLE}`);
    } else {
      console.log("  MinIO S3:    ⬜ 미실행");
    }
  } catch {
    console.log("  MinIO S3:    ⬜ 미실행");
  }

  // S3 bucket (MinIO)
  try {
    const res = await fetch(`${MINIO_ENDPOINT}/qa-sdk-infra-state/`, {
      method: "HEAD",
      headers: { Authorization: "AWS4-HMAC-SHA256" },
      signal: AbortSignal.timeout(2000),
    });
    // MinIO returns 403 for existing buckets without auth, 404 for non-existing
    console.log(`  S3 버킷:    ${res.status !== 404 ? "✅ 존재" : "⬜ 미생성"}`);
  } catch {
    console.log("  S3 버킷:    ⬜ 확인 불가");
  }

  // K8s
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("kubectl", ["get", "nodes", "--no-headers", "--request-timeout=3s"]);
    const nodeCount = stdout.trim().split("\n").filter(Boolean).length;
    console.log(`  K8s:        🟢 ${nodeCount}개 노드`);
  } catch {
    console.log("  K8s:        ⬜ 미실행");
  }

  // K8s namespaces
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("kubectl", ["get", "ns", "--no-headers", "--request-timeout=3s"]);
    const ns = stdout
      .trim()
      .split("\n")
      .filter((l) => l.includes("qa-"))
      .map((l) => l.trim().split(/\s+/)[0]);
    if (ns.length > 0) {
      console.log(`  네임스페이스: ${ns.join(", ")}`);
    }
  } catch {
    /* K8s 미실행 — 위에서 이미 표시 */
  }

  // 서비스: registry-service
  try {
    const registryUrl = config?.services.registry ?? process.env.REGISTRY_URL ?? "http://localhost:3300";
    const res = await fetch(new URL("/health", registryUrl), { signal: AbortSignal.timeout(2000) });
    console.log(`  Registry:   ${res.ok ? `🟢 실행 중 (${registryUrl})` : "⬜ 미실행"}`);
  } catch {
    console.log("  Registry:   ⬜ 미실행");
  }

  // 서비스: ingest-server
  try {
    const ingestUrl = config?.services.ingest ?? process.env.INGEST_URL ?? "http://localhost:3200";
    const res = await fetch(new URL("/health/live", ingestUrl), { signal: AbortSignal.timeout(2000) });
    const storeMode = config?.ingestStore ?? process.env.STORE_DRIVER ?? "memory";
    console.log(`  Ingest:     ${res.ok ? `🟢 실행 중 (${storeMode} 모드, ${ingestUrl})` : "⬜ 미실행"}`);
  } catch {
    console.log("  Ingest:     ⬜ 미실행");
  }

  // 서비스: definition-service
  try {
    const definitionUrl = config?.services.definition ?? process.env.DEFINITION_URL ?? "http://localhost:3700";
    const res = await fetch(new URL("/health", definitionUrl), { signal: AbortSignal.timeout(2000) });
    console.log(`  Definition: ${res.ok ? `🟢 실행 중 (${definitionUrl})` : "⬜ 미실행"}`);
  } catch {
    console.log("  Definition: ⬜ 미실행");
  }

  // Zitadel
  try {
    const res = await fetch("http://localhost:8085/debug/healthz", { signal: AbortSignal.timeout(2000) });
    console.log(`  Zitadel:    ${res.ok ? "🟢 실행 중 (localhost:8085)" : "⬜ 미실행"}`);
  } catch {
    console.log("  Zitadel:    ⬜ 미실행");
  }

  // Enrichment Server
  try {
    const enrichPort = process.env.ENRICHMENT_PORT ?? "3900";
    const res = await fetch(`http://localhost:${enrichPort}/health`, { signal: AbortSignal.timeout(2000) });
    console.log(`  Enrichment: ${res.ok ? `🟢 실행 중 (localhost:${enrichPort})` : "⬜ 미실행"}`);
  } catch {
    console.log("  Enrichment: ⬜ 미실행");
  }

  // Pulumi backend
  const backend = process.env.PULUMI_BACKEND_URL ?? "file://~/.pulumi-local";
  const isMinioS3 = backend.includes("localhost") || backend.includes("127.0.0.1");
  const pulumiLabel = backend.startsWith("s3://")
    ? isMinioS3 ? "📦 MinIO S3 (로컬)" : "☁ AWS S3"
    : "📁 파일";
  console.log(`  Pulumi:     ${pulumiLabel} (${backend.split("?")[0]})`);

  try {
    if (!config) {
      const { loadInfraConfig } = await import("./config-manager.js");
      config = await loadInfraConfig();
    }
    const configuredLabel = config.backend === "minio"
      ? `minio (${config.s3Endpoint ?? "endpoint 미지정"})`
      : config.backend === "s3"
        ? `s3 (${config.s3Bucket})`
        : "file";
    console.log(`  Config:     ${configuredLabel}`);
    if (config.backend === "minio" && !minioRunning) {
      console.log("  Warning:    MinIO backend로 설정됐지만 현재 endpoint에 연결되지 않음");
    }
  } catch {
    /* config 조회 실패는 상태 출력에 영향 주지 않음 */
  }

  console.log("");
}

export async function envReset(cwd: string): Promise<void> {
  const { execa } = await import("execa");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "down", "-v"], { cwd, stdio: "inherit" });
  console.log("[env] MinIO 종료 + 볼륨 삭제 (초기화 완료)");
}

/** MinIO 실행 여부 확인 + 환경변수 자동 설정 */
export async function detectEnvironment(preferredBackend?: "file" | "minio" | "s3"): Promise<"minio" | "file"> {
  // 명시적 backend profile이 file/s3면 MinIO fallback을 금지
  if (preferredBackend === "file" || preferredBackend === "s3") {
    return "file";
  }

  // 이미 backend URL이 정해져 있으면 그대로 존중
  if (process.env.PULUMI_BACKEND_URL) {
    const isLocalMinio = process.env.PULUMI_BACKEND_URL.includes("localhost")
      || process.env.PULUMI_BACKEND_URL.includes("127.0.0.1");
    return isLocalMinio ? "minio" : "file";
  }

  // 명시적 MinIO endpoint 설정 확인
  if (process.env.INFRA_AWS_ENDPOINT) {
    return "minio";
  }

  // MinIO 자동 감지 — secrets에서 자격증명 로드, fallback은 기본값
  try {
    const res = await fetch(`${MINIO_ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      process.env.INFRA_AWS_ENDPOINT ??= MINIO_ENDPOINT;
      // secrets에서 MinIO 자격증명 로드
      try {
        const { loadSecrets } = await import("./secrets-manager.js");
        const secrets = await loadSecrets();
        process.env.AWS_ACCESS_KEY_ID ??= secrets?.minioRootUser ?? "minioadmin";
        process.env.AWS_SECRET_ACCESS_KEY ??= secrets?.minioRootPassword ?? "minioadmin";
      } catch {
        process.env.AWS_ACCESS_KEY_ID ??= "minioadmin";
        process.env.AWS_SECRET_ACCESS_KEY ??= "minioadmin";
      }
      process.env.AWS_DEFAULT_REGION ??= "ap-northeast-2";
      process.env.PULUMI_BACKEND_URL ??=
        `s3://qa-sdk-infra-state?endpoint=${MINIO_ENDPOINT}&disableSSL=true&s3ForcePathStyle=true`;
      return "minio";
    }
  } catch {
    /* MinIO 미실행 */
  }

  return "file";
}
