import type { DiscoveryClient } from "../discovery/client.js";
import { generateTypescriptModule } from "../export/typescript-module.js";
import { generateEnvFile } from "../export/env-file.js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export interface CodegenOptions {
  /** TypeScript 모듈 출력 경로 (기본: generated/service-connections.{env}.ts) */
  tsOutputDir?: string;
  /** .env 파일 출력 디렉토리 (기본: generated/env/) */
  envOutputDir?: string;
  /** 대상 서비스 (기본: 배포된 서비스의 depends_on 역추적) */
  targetServices?: string[];
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

  // 1. TypeScript 연결 모듈 재생성
  await mkdir(tsDir, { recursive: true });
  const tsContent = await generateTypescriptModule(discovery, env);
  const tsPath = resolve(tsDir, `service-connections.${env}.ts`);
  await writeFile(tsPath, tsContent);

  // 2. 배포된 서비스 + 의존 서비스의 .env 파일 재생성
  await mkdir(envDir, { recursive: true });
  const allServices = await discovery.listServices();

  // 배포된 서비스 자체
  const selfEnv = await generateEnvFile(discovery, { serviceId: deployedServiceId, env });
  const selfPath = resolve(envDir, `.env.${deployedServiceId}.${env}`);
  await writeFile(selfPath, selfEnv);
  envPaths.push(selfPath);

  // 배포된 서비스에 의존하는 서비스들 (reverse deps)
  const targets = options?.targetServices ?? findDependentServices(allServices, deployedServiceId);
  for (const targetId of targets) {
    const envContent = await generateEnvFile(discovery, { serviceId: targetId, env });
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
