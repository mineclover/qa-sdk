// export/typescript-module.ts — TypeScript 서비스 연결 모듈 생성기
import type { DiscoveryClient } from "../discovery/client.js";

/** 서비스 연결 정보가 담긴 TypeScript 모듈 생성 */
export async function generateTypescriptModule(
  discovery: DiscoveryClient,
  env: string,
  serviceIds?: string[],
): Promise<string> {
  const allServices = await discovery.listServices();
  const targets = serviceIds
    ? allServices.filter((s) => serviceIds.includes(s.serviceId))
    : allServices.filter((s) => s.url);

  const urls = await discovery.resolveAll(env);

  const lines: string[] = [
    `// 자동 생성된 서비스 연결 모듈`,
    `// env: ${env}`,
    `// 생성 시각: ${new Date().toISOString()}`,
    `// 수정 금지 — infra-engine export로 재생성`,
    ``,
    `/** 서비스 URL 맵 */`,
    `export const SERVICE_URLS = {`,
  ];

  for (const [id, url] of Object.entries(urls).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const svc = targets.find((s) => s.serviceId === id);
    const comment = svc ? ` // ${svc.name}` : "";
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

  // 서비스별 타입 상수
  lines.push(`// --- 서비스별 연결 상수 ---`, ``);
  for (const svc of targets) {
    if (!urls[svc.serviceId]) continue;
    const varName = svc.serviceId.replace(/-/g, "_").toUpperCase();
    lines.push(
      `/** ${svc.name} (${svc.tier}) */`,
      `export const ${varName} = {`,
      `  url: "${urls[svc.serviceId]}",`,
      `  serviceId: "${svc.serviceId}" as const,`,
      `  tier: "${svc.tier}",`,
      `  ownedPrefixes: ${JSON.stringify(svc.ownedPrefixes)} as const,`,
      `  consumedPrefixes: ${JSON.stringify(svc.consumedPrefixes)} as const,`,
      `} as const;`,
      ``,
    );
  }

  return lines.join("\n");
}
