// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { DiscoveryClient } from "../discovery/client.js";
import { generateTypescriptModule } from "../export/typescript-module.js";
import { generateEnvFile } from "../export/env-file.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface CodegenOptions {
  /** TypeScript 모듈 출력 경로 (기본: generated/service-connections.{env}.ts) */
  tsOutputDir?: string;
  /** .env 파일 출력 디렉토리 (기본: generated/env/) */
  envOutputDir?: string;
  /** 대상 서비스 (기본: 배포된 서비스의 depends_on 역추적) */
  targetServices?: string[];
  /** config JSON 경로 (미지정 시 config/{env}.json 자동 탐색) */
  configPath?: string;
}

/** config JSON에서 서비스별 설정을 로딩 */
async function loadServiceConfigs(
  env: string,
  configPath?: string,
): Promise<Record<string, Record<string, unknown>>> {
  try {
    const path =
      configPath ??
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        `../../config/${env}.json`,
      );
    const raw = JSON.parse(await readFile(path, "utf-8"));
    return (raw.services ?? {}) as Record<string, Record<string, unknown>>;
  } catch {
    return {};
  }
}

export async function runPostDeployCodegen(
  discovery: DiscoveryClient,
  deployedServiceId: string,
  env: string,
  options?: CodegenOptions,
): Promise<{ tsPath?: string; envPaths: string[] }> {
  const tsDir = options?.tsOutputDir ?? "generated";
  const envDir = options?.envOutputDir ?? "generated/env";
  const envPaths: string[] = [];

  // config JSON 로딩
  const serviceConfigs = await loadServiceConfigs(env, options?.configPath);

  // 1. TypeScript 연결 모듈 재생성
  await mkdir(tsDir, { recursive: true });
  const tsContent = await generateTypescriptModule(discovery, env);
  const tsPath = resolve(tsDir, `service-connections.${env}.ts`);
  await writeFile(tsPath, tsContent);

  // 2. 배포된 서비스 + 의존 서비스의 .env 파일 재생성
  await mkdir(envDir, { recursive: true });
  const allServices = await discovery.listServices();

  // 배포된 서비스 자체
  const selfEnv = await generateEnvFile(
    discovery,
    { serviceId: deployedServiceId, env },
    serviceConfigs[deployedServiceId],
  );
  const selfPath = resolve(envDir, `.env.${deployedServiceId}.${env}`);
  await writeFile(selfPath, selfEnv);
  envPaths.push(selfPath);

  // 배포된 서비스에 의존하는 서비스들 (reverse deps)
  const targets = options?.targetServices ?? findDependentServices(allServices, deployedServiceId);
  for (const targetId of targets) {
    const envContent = await generateEnvFile(
      discovery,
      { serviceId: targetId, env },
      serviceConfigs[targetId],
    );
    const envPath = resolve(envDir, `.env.${targetId}.${env}`);
    await writeFile(envPath, envContent);
    envPaths.push(envPath);
  }

  return { tsPath, envPaths };
}

/** deployedServiceId에 의존하는 서비스 찾기 (consumedPrefixes 기반 역추적) */
function findDependentServices(services: any[], deployedServiceId: string): string[] {
  const deployed = services.find(s => s.serviceId === deployedServiceId);
  if (!deployed) return [];

  const deployedPrefixes = new Set<string>(deployed.ownedPrefixes ?? []);
  if (deployedPrefixes.size === 0) return [];

  return services
    .filter(s =>
      s.serviceId !== deployedServiceId &&
      s.consumedPrefixes?.some((p: string) => deployedPrefixes.has(p)),
    )
    .map(s => s.serviceId);
}
