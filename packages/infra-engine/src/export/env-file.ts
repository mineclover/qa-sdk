// export/env-file.ts — .env 파일 생성기
import type { DiscoveryClient } from "../discovery/client.js";

export interface EnvFileOptions {
  serviceId: string;
  env: string;
  /** true: 모든 서비스 URL 포함, false: consumedPrefixes 기반 필요 서비스만 */
  includeAll?: boolean;
}

/** 서비스용 .env 파일 내용 생성 */
export async function generateEnvFile(
  discovery: DiscoveryClient,
  options: EnvFileOptions,
): Promise<string> {
  const [urls, svc] = await Promise.all([
    discovery.resolveAll(options.env),
    discovery.resolve(options.serviceId, options.env),
  ]);

  const lines: string[] = [
    `# 자동 생성 — ${options.serviceId} (${options.env})`,
    `# 생성 시각: ${new Date().toISOString()}`,
    `# 수정 금지 — infra-engine export로 재생성`,
    ``,
    `NODE_ENV=${options.env === "prod" ? "production" : "development"}`,
  ];

  if (svc) {
    const port = extractPort(svc.url);
    lines.push(`PORT=${port}`);
  }

  // 서비스 연결 URL
  lines.push(``, `# 서비스 연결`);

  const sortedEntries = Object.entries(urls).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (options.includeAll) {
    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId) {
        const envKey = toEnvKey(id);
        lines.push(`${envKey}=${url}`);
      }
    }
  } else if (svc) {
    // consumedPrefixes 기반 — 어떤 서비스가 해당 prefix를 소유하는지 매칭
    // 간단한 방식: URL이 있는 다른 서비스를 모두 포함 (prefix 매칭은 향후 개선)
    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId) {
        const envKey = toEnvKey(id);
        lines.push(`${envKey}=${url}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

function toEnvKey(serviceId: string): string {
  return serviceId.replace(/-/g, "_").toUpperCase() + "_URL";
}

function extractPort(url: string): string {
  const match = url.match(/:(\d+)$/);
  return match?.[1] ?? "3200";
}
