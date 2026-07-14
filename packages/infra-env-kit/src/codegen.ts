// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EnvDiscoveryClient } from './types.js';
import { generateTypescriptModule } from './typescript-module.js';
import { generateEnvFile } from './env-file.js';

export interface CodegenOptions {
  /** TypeScript 모듈 출력 경로 (기본: generated/service-connections.{env}.ts) */
  tsOutputDir?: string;
  /** .env 파일 출력 디렉토리 (기본: generated/env/) */
  envOutputDir?: string;
  /** 대상 서비스 (기본: 배포된 서비스의 consumedPrefixes 역추적) */
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
      resolve(dirname(fileURLToPath(import.meta.url)), `../../../infra-engine/config/${env}.json`);
    const raw = JSON.parse(await readFile(path, 'utf-8'));
    return (raw.services ?? {}) as Record<string, Record<string, unknown>>;
  } catch {
    return {};
  }
}

export async function runPostDeployCodegen(
  discovery: EnvDiscoveryClient,
  deployedServiceId: string,
  env: string,
  options?: CodegenOptions,
): Promise<{ tsPath?: string; envPaths: string[] }> {
  const tsDir = options?.tsOutputDir ?? 'generated';
  const envDir = options?.envOutputDir ?? 'generated/env';
  const envPaths: string[] = [];

  const serviceConfigs = await loadServiceConfigs(env, options?.configPath);

  await mkdir(tsDir, { recursive: true });
  const tsContent = await generateTypescriptModule(discovery, env);
  const tsPath = resolve(tsDir, `service-connections.${env}.ts`);
  await writeFile(tsPath, tsContent);

  await mkdir(envDir, { recursive: true });
  const allServices = await discovery.listServices();

  const selfEnv = await generateEnvFile(
    discovery,
    { serviceId: deployedServiceId, env },
    serviceConfigs[deployedServiceId],
  );
  const selfPath = resolve(envDir, `.env.${deployedServiceId}.${env}`);
  await writeFile(selfPath, selfEnv);
  envPaths.push(selfPath);

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
function findDependentServices(
  services: Awaited<ReturnType<EnvDiscoveryClient['listServices']>>,
  deployedServiceId: string,
): string[] {
  const deployed = services.find((service) => service.serviceId === deployedServiceId);
  if (!deployed) return [];

  const deployedPrefixes = new Set<string>(deployed.ownedPrefixes ?? []);
  if (deployedPrefixes.size === 0) return [];

  return services
    .filter(
      (service) =>
        service.serviceId !== deployedServiceId &&
        service.consumedPrefixes?.some((prefix) => deployedPrefixes.has(prefix)),
    )
    .map((service) => service.serviceId);
}
