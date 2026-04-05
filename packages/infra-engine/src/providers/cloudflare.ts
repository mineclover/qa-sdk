// providers/cloudflare.ts — Cloudflare Workers/Pages 프로바이더
// wrangler CLI를 래핑하여 기존 wrangler.toml과 호환
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export interface CloudflareProviderOptions {
  /** 프로젝트 루트 (wrangler.toml이 있는 위치). 기본: 자동 탐색 */
  projectRoot?: string;
}

export function createCloudflareProvider(options?: CloudflareProviderOptions): DeployProvider {
  return {
    name: "cloudflare",

    getProgram(config: ResolvedConfig, serviceId: string) {
      // Cloudflare는 Pulumi Program 대신 wrangler CLI 사용
      // getProgram은 호출되지 않음 — deployFn에서 직접 wrangler 실행
      return async () => {
        throw new Error("Cloudflare는 pulumiDeployFn 대신 wranglerDeployFn을 사용하세요");
      };
    },

    async destroy(stackName: string) {
      // Cloudflare는 wrangler.toml의 name으로 ���제 — stackName 파싱 불필요
      // 실제로는 wrangler delete를 해당 서비스 디렉토리에서 실행
      const { execa } = await import("execa");
      const serviceId = stackName.split("-").slice(0, -3).join("-");
      try {
        const cwd = await findServiceDir(serviceId, options?.projectRoot);
        console.log(`[cloudflare] deleting worker from ${cwd}...`);
        await execa("npx", ["wrangler", "delete"], { cwd, stdio: "inherit", input: "y\n" });
      } catch (err) {
        console.warn(`[cloudflare] destroy 건너뜀: ${err instanceof Error ? err.message : err}`);
      }
    },

    async validate(_config: ResolvedConfig): Promise<ValidationResult> {
      try {
        const { execa } = await import("execa");
        const { stdout } = await execa("npx", ["wrangler", "whoami"], { timeout: 10_000 });
        if (stdout.includes("You are logged in")) {
          return { valid: true, errors: [] };
        }
        return { valid: false, errors: ["wrangler 인증 안 됨. `npx wrangler login` 실행 필요"] };
      } catch {
        return { valid: false, errors: ["wrangler CLI를 사용할 수 없습니다. `npm i -g wrangler` 또는 `npx wrangler login`"] };
      }
    },
  };
}

/** wrangler deploy를 실행하는 배포 함수 — pulumiDeployFn 대신 사용 */
export async function wranglerDeployFn(
  provider: DeployProvider,
  config: ResolvedConfig,
  serviceId: string,
  stackName: string,
): Promise<{ stackName: string; outputs: Record<string, string> }> {
  const { execa } = await import("execa");

  // 서비스 디렉토리 찾기
  const cwd = await findServiceDir(serviceId);

  // 설정에서 env vars 추출 → wrangler vars로 전달
  const svcConfig = config.services[serviceId];
  const vars: string[] = [];
  if (svcConfig) {
    for (const [key, value] of Object.entries(svcConfig)) {
      if (typeof value === "string" || typeof value === "number") {
        if (key !== "port" && key !== "depends_on" && key !== "gates") {
          const safeKey = key.toUpperCase();
          if (!/^[A-Z_][A-Z0-9_]*$/.test(safeKey)) continue;
          vars.push("--var", `${safeKey}:${String(value)}`);
        }
      }
    }
  }

  // 연결 정보 주입 (connections → env vars)
  const deps = svcConfig?.depends_on as string[] | undefined;
  if (deps) {
    for (const dep of deps) {
      const conn = config.connections[dep];
      if (conn?.endpoint) {
        const envKey = dep.replace(/-/g, "_").toUpperCase() + "_URL";
        vars.push("--var", `${envKey}:${conn.endpoint}`);
      }
    }
  }

  console.log(`[cloudflare] deploying ${serviceId}...`);
  const args = ["wrangler", "deploy", ...vars];
  // stdout를 캡��하면서 동시에 출력 (pipe)
  const result = await execa("npx", args, { cwd, stdout: "pipe", stderr: "inherit" });
  // stdout 출력
  if (result.stdout) process.stdout.write(result.stdout + "\n");

  // wrangler 출력에서 URL 추출
  const urlMatch = result.stdout?.match(/https:\/\/[^\s]+\.workers\.dev/);
  // connections에서 endpoint도 참조
  const connEndpoint = config.connections[serviceId]?.endpoint;
  const endpoint = urlMatch?.[0] ?? connEndpoint ?? `https://${serviceId}.workers.dev`;

  return {
    stackName,
    outputs: {
      endpoint,
      provider: "cloudflare",
      workerName: serviceId,
    },
  };
}

/** 서비스 디렉토리 탐색 — packages/{serviceId}에 wrangler.toml이 있는지 확인 */
async function findServiceDir(serviceId: string, projectRoot?: string): Promise<string> {
  const { resolve } = await import("node:path");
  const { access } = await import("node:fs/promises");

  // 프로젝트 루트 추정
  const root = projectRoot ?? resolve(process.cwd(), "../..");

  // 1. packages/{serviceId}/wrangler.toml
  const direct = resolve(root, "packages", serviceId);
  try {
    await access(resolve(direct, "wrangler.toml"));
    return direct;
  } catch {}

  // 2. wrangler.toml의 name 필드로 매핑 (qa-decode-service → decode-service)
  const { readdir, readFile } = await import("node:fs/promises");
  const pkgDirs = await readdir(resolve(root, "packages"));
  for (const dir of pkgDirs) {
    try {
      const wrangler = await readFile(resolve(root, "packages", dir, "wrangler.toml"), "utf-8");
      const nameMatch = wrangler.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch && (nameMatch[1] === serviceId || nameMatch[1] === `qa-${serviceId}`)) {
        return resolve(root, "packages", dir);
      }
    } catch {}
  }

  throw new Error(`${serviceId}의 wrangler.toml을 찾을 수 없습니다. packages/${serviceId}/wrangler.toml 확인 필요.`);
}
