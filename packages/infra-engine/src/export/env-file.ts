// export/env-file.ts — .env 파일 생성기
import type { DiscoveryClient } from "../discovery/client.js";

/** 모든 서비스가 기본으로 필요로 하는 core 서비스 */
const CORE_SERVICE_IDS = new Set(["ingest-server", "registry-service"]);

export interface EnvFileOptions {
  serviceId: string;
  env: string;
  /** true: 모든 서비스 URL 포함, false(기본): consumedPrefixes + core 서비스만 */
  includeAll?: boolean;
}

/** 서비스용 .env 파일 내용 생성 */
export async function generateEnvFile(
  discovery: DiscoveryClient,
  options: EnvFileOptions,
): Promise<string> {
  const [urls, svc, allServices] = await Promise.all([
    discovery.resolveAll(options.env),
    discovery.resolve(options.serviceId, options.env),
    discovery.listServices(),
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
  } else {
    // consumedPrefixes 기반 필터링: 소비하는 prefix의 소유 서비스 + core 서비스
    const neededServiceIds = new Set<string>(CORE_SERVICE_IDS);

    if (svc) {
      const consumed = new Set(svc.consumedPrefixes ?? []);
      for (const s of allServices) {
        if (s.ownedPrefixes?.some((p) => consumed.has(p))) {
          neededServiceIds.add(s.serviceId);
        }
      }
    }

    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId && neededServiceIds.has(id)) {
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
