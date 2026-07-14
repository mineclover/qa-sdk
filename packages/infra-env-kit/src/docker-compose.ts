// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { EnvDiscoveryClient } from './types.js';

export async function generateDockerComposeOverride(
  discovery: EnvDiscoveryClient,
  env: string,
): Promise<string> {
  const services = await discovery.listServices();
  const urls = await discovery.resolveAll(env);

  const lines: string[] = [
    `# 자동 생성 — docker-compose.override.yml`,
    `# env: ${env}`,
    `# 생성 시각: ${new Date().toISOString()}`,
    `# 수정 금지 — infra-env-kit export로 재생성`,
    ``,
    `services:`,
  ];

  for (const service of services.filter(
    (candidate) => candidate.url && candidate.tier !== 'system',
  )) {
    const port = service.url.match(/:(\d+)$/)?.[1] ?? '3200';
    const envVars: string[] = [];

    for (const [id, url] of Object.entries(urls).toSorted(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (id !== service.serviceId) {
        const envKey = id.replace(/-/g, '_').toUpperCase() + '_URL';
        envVars.push(`      ${envKey}: "${url}"`);
      }
    }

    lines.push(
      `  ${service.serviceId}:`,
      `    environment:`,
      `      NODE_ENV: ${env === 'prod' ? 'production' : 'development'}`,
      `      PORT: "${port}"`,
      ...envVars,
    );
  }

  return lines.join('\n') + '\n';
}
