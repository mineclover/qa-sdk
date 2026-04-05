// commands/env-manager.ts — 로컬 인프라 환경 관리 (LocalStack + K8s)

const COMPOSE_FILE = "docker-compose.infra.yaml";

export async function envUp(cwd: string): Promise<void> {
  const { execa } = await import("execa");
  console.log("[env] LocalStack 시작...");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { cwd, stdio: "inherit" });

  // 헬스체크 대기
  console.log("[env] 초기화 대기 중...");
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:4566/_localstack/health", { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { services?: Record<string, string> };
        const ready = Object.values(data.services ?? {}).every(
          (s) => s === "available" || s === "running",
        );
        if (ready) {
          console.log("[env] LocalStack 준비 완료");
          break;
        }
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
    console.log("[env] K8s 클러스터 미실행 — 'k3d cluster create qa-local' 필요");
  }
}

export async function envDown(cwd: string): Promise<void> {
  const { execa } = await import("execa");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "down"], { cwd, stdio: "inherit" });
  console.log("[env] LocalStack 종료");
}

export async function envStatus(): Promise<void> {
  console.log("\n=== 인프라 환경 상태 ===\n");

  // LocalStack
  try {
    const res = await fetch("http://localhost:4566/_localstack/health", { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = (await res.json()) as { services?: Record<string, string> };
      console.log("  LocalStack:  실행 중");
      for (const [svc, status] of Object.entries(data.services ?? {})) {
        const icon = status === "available" || status === "running" ? "[OK]" : "[WARN]";
        console.log(`    ${icon} ${svc}: ${status}`);
      }
    }
  } catch {
    console.log("  LocalStack:  미실행");
  }

  // S3 bucket
  try {
    const res = await fetch("http://localhost:4566/qa-sdk-infra-state", {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    });
    console.log(`  S3 버킷:    ${res.ok ? "존재" : "미생성"}`);
  } catch {
    console.log("  S3 버킷:    확인 불가");
  }

  // K8s
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("kubectl", ["get", "nodes", "--no-headers", "--request-timeout=3s"]);
    const nodeCount = stdout.trim().split("\n").filter(Boolean).length;
    console.log(`  K8s:        ${nodeCount}개 노드`);
  } catch {
    console.log("  K8s:        미실행");
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

  console.log("");
}

export async function envReset(cwd: string): Promise<void> {
  const { execa } = await import("execa");
  await execa("docker", ["compose", "-f", COMPOSE_FILE, "down", "-v"], { cwd, stdio: "inherit" });
  console.log("[env] LocalStack 종료 + 볼륨 삭제 (초기화 완료)");
}

/** LocalStack 실행 여부 확인 + 환경변수 자동 설정 */
export async function detectEnvironment(): Promise<"localstack" | "file"> {
  if (process.env.INFRA_AWS_ENDPOINT) {
    return "localstack";
  }

  try {
    const res = await fetch("http://localhost:4566/_localstack/health", { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      // LocalStack 감지 → 환경변수 자동 설정
      process.env.INFRA_AWS_ENDPOINT ??= "http://localhost:4566";
      process.env.AWS_ACCESS_KEY_ID ??= "test";
      process.env.AWS_SECRET_ACCESS_KEY ??= "test";
      process.env.AWS_DEFAULT_REGION ??= "ap-northeast-2";
      process.env.PULUMI_BACKEND_URL ??=
        "s3://qa-sdk-infra-state?endpoint=http://localhost:4566&disableSSL=true&s3ForcePathStyle=true";
      return "localstack";
    }
  } catch {
    /* LocalStack 미실행 */
  }

  return "file";
}
