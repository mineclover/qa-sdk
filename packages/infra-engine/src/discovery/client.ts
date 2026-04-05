/**
 * 서비스 디스커버리 클라이언트
 *
 * 사용 예시:
 *   const discovery = createDiscoveryClient("http://localhost:3300");
 *   const ingest = await discovery.resolve("ingest-server", "dev");
 *   // { url: "http://localhost:3200", serviceId: "ingest-server", name: "이벤트 수집", ... }
 *
 *   const urls = await discovery.resolveAll("dev");
 *   // { "ingest-server": "http://localhost:3200", "registry-service": "http://localhost:3300", ... }
 *
 *   const code = await discovery.generateConnectCode("ingest-server", "dev");
 *   // export const INGEST_SERVER_URL = "http://localhost:3200";
 *   // export async function connectIngestServer() { ... }
 */

export interface ServiceInfo {
  serviceId: string;
  name: string;
  url: string;
  tier: string;
  team: string;
  ownedPrefixes: string[];
  consumedPrefixes: string[];
  urls?: Record<string, string>;
  /** env별 URL이 없어 기본 URL로 대체된 경우 true */
  urlFallback?: boolean;
}

export interface DiscoveryClient {
  /** 단일 서비스 조회 -- env별 URL 해석 */
  resolve(serviceId: string, env?: string): Promise<ServiceInfo | null>;

  /** 전체 서비스 URL 맵 조회 (env별) */
  resolveAll(env?: string): Promise<Record<string, string>>;

  /** 서비스 목록 조회 */
  listServices(): Promise<ServiceInfo[]>;

  /** 서비스 연결 코드 생성 -- 타입스크립트 코드 문자열 반환 */
  generateConnectCode(serviceId: string, env?: string): Promise<string>;

  /** 여러 서비스의 연결 코드를 한번에 생성 */
  generateConnectCodeAll(serviceIds: string[], env?: string): Promise<string>;
}

export function createDiscoveryClient(registryUrl: string, catalogId?: string): DiscoveryClient {
  const catalog = catalogId ?? "demo";

  async function fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${registryUrl}${path}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`registry 조회 실패 (${res.status}): ${path}`);
    return res.json() as Promise<T>;
  }

  return {
    async resolve(serviceId, env) {
      try {
        const svc = await fetchJson<ServiceInfo>(`/api/services/${serviceId}?catalog=${catalog}`);
        // env별 URL 해석
        if (env && svc.urls?.[env]) {
          svc.url = svc.urls[env];
        } else if (env && svc.urls && !svc.urls[env]) {
          // 요청한 env URL이 registry에 등록되어 있지 않음 — 기본 URL 사용
          svc.urlFallback = true;
        }
        return svc;
      } catch {
        return null;
      }
    },

    async resolveAll(env) {
      const envParam = env ? `&env=${env}` : "";
      return fetchJson<Record<string, string>>(`/api/services/urls?catalog=${catalog}${envParam}`);
    },

    async listServices() {
      return fetchJson<ServiceInfo[]>(`/api/services?catalog=${catalog}`);
    },

    async generateConnectCode(serviceId, env) {
      const svc = await this.resolve(serviceId, env);
      if (!svc) return `// 서비스 "${serviceId}"를 찾을 수 없습니다`;

      const varName = serviceId.replace(/-/g, "_").toUpperCase();
      const fnName = serviceId
        .split("-")
        .map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1)))
        .join("");

      const fallbackWarning = svc.urlFallback
        ? `// ⚠ ${env} URL이 registry에 등록되어 있지 않습니다. 기본 URL을 사용합니다.\n`
        : "";

      return [
        `// ${svc.name} (${svc.serviceId})`,
        `// env: ${env ?? "default"}, tier: ${svc.tier}, team: ${svc.team}`,
        ...(fallbackWarning ? [fallbackWarning.trimEnd()] : []),
        `export const ${varName}_URL = "${svc.url}";`,
        ``,
        `/** ${svc.name}에 연결 -- 헬스체크 후 URL 반환 */`,
        `export async function connect${fnName[0].toUpperCase() + fnName.slice(1)}(): Promise<string> {`,
        `  const url = ${varName}_URL;`,
        `  const res = await fetch(\`\${url}/health\`, { signal: AbortSignal.timeout(5000) });`,
        `  if (!res.ok) throw new Error(\`${svc.name} 연결 실패: \${res.status}\`);`,
        `  return url;`,
        `}`,
        ``,
        `// ownedPrefixes: ${JSON.stringify(svc.ownedPrefixes)}`,
        `// consumedPrefixes: ${JSON.stringify(svc.consumedPrefixes)}`,
      ].join("\n");
    },

    async generateConnectCodeAll(serviceIds, env) {
      const codes = await Promise.all(serviceIds.map((id) => this.generateConnectCode(id, env)));
      return [
        `// 자동 생성된 서비스 연결 코드`,
        `// env: ${env ?? "default"}`,
        `// 생성 시각: ${new Date().toISOString()}`,
        ``,
        ...codes,
      ].join("\n\n");
    },
  };
}
