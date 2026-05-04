// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { EnvDiscoveryClient } from "./types.js";

export async function generateTypescriptModule(
  discovery: EnvDiscoveryClient,
  env: string,
  serviceIds?: string[],
): Promise<string> {
  const allServices = await discovery.listServices();
  const targets = serviceIds
    ? allServices.filter((service) => serviceIds.includes(service.serviceId))
    : allServices.filter((service) => service.url);

  const urls = await discovery.resolveAll(env);

  const lines: string[] = [
    `// 자동 생성된 서비스 연결 모듈`,
    `// env: ${env}`,
    `// 생성 시각: ${new Date().toISOString()}`,
    `// 수정 금지 — infra-env-kit export로 재생성`,
    ``,
    `/** 서비스 URL 맵 */`,
    `export const SERVICE_URLS = {`,
  ];

  for (const [id, url] of Object.entries(urls).toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const service = targets.find((target) => target.serviceId === id);
    const comment = service ? ` // ${service.name}` : "";
    lines.push(`  "${id}": "${url}",${comment}`);
  }
  lines.push(`} as const;`, ``);

  lines.push(`export type ServiceId = keyof typeof SERVICE_URLS;`, ``);

  lines.push(
    `/** 서비스 URL 조회 */`,
    `export function getServiceUrl(serviceId: ServiceId): string {`,
    `  return SERVICE_URLS[serviceId];`,
    `}`,
    ``,
  );

  lines.push(
    `/** 서비스 헬스체크 */`,
    `export async function checkHealth(serviceId: ServiceId): Promise<boolean> {`,
    `  try {`,
    "    const res = await fetch(`${SERVICE_URLS[serviceId]}/health`, { signal: AbortSignal.timeout(5000) });",
    `    return res.ok;`,
    `  } catch {`,
    `    return false;`,
    `  }`,
    `}`,
    ``,
  );

  lines.push(`// --- 서비스별 연결 상수 ---`, ``);
  for (const service of targets) {
    if (!urls[service.serviceId]) continue;
    const varName = service.serviceId.replace(/-/g, "_").toUpperCase();
    lines.push(
      `/** ${service.name} (${service.tier}) */`,
      `export const ${varName} = {`,
      `  url: "${urls[service.serviceId]}",`,
      `  serviceId: "${service.serviceId}" as const,`,
      `  tier: "${service.tier}",`,
      `  ownedPrefixes: ${JSON.stringify(service.ownedPrefixes)} as const,`,
      `  consumedPrefixes: ${JSON.stringify(service.consumedPrefixes)} as const,`,
      `} as const;`,
      ``,
    );
  }

  return lines.join("\n");
}
