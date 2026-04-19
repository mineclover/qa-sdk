// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// export/docker-compose.ts — docker-compose override 생성기
import type { DiscoveryClient } from "../discovery/client.js";

/** registry 데이터 기반 docker-compose.override.yml 생성 */
export async function generateDockerComposeOverride(
  discovery: DiscoveryClient,
  env: string,
): Promise<string> {
  const services = await discovery.listServices();
  const urls = await discovery.resolveAll(env);

  const lines: string[] = [
    `# 자동 생성 — docker-compose.override.yml`,
    `# env: ${env}`,
    `# 생성 시각: ${new Date().toISOString()}`,
    `# 수정 금지 — infra-engine export로 재생성`,
    ``,
    `services:`,
  ];

  for (const svc of services.filter((s) => s.url && s.tier !== "system")) {
    const port = svc.url.match(/:(\d+)$/)?.[1] ?? "3200";
    const envVars: string[] = [];

    // 다른 서비스 URL을 환경변수로 주입
    for (const [id, url] of Object.entries(urls).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (id !== svc.serviceId) {
        const envKey = id.replace(/-/g, "_").toUpperCase() + "_URL";
        envVars.push(`      ${envKey}: "${url}"`);
      }
    }

    lines.push(
      `  ${svc.serviceId}:`,
      `    environment:`,
      `      NODE_ENV: ${env === "prod" ? "production" : "development"}`,
      `      PORT: "${port}"`,
      ...envVars,
    );
  }

  return lines.join("\n") + "\n";
}
