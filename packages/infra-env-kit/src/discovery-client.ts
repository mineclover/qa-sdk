// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { EnvDiscoveryClient, EnvServiceInfo } from './types.js';

export function createEnvRegistryDiscoveryClient(
  registryUrl: string,
  catalogId?: string,
): EnvDiscoveryClient {
  const catalog = catalogId ?? 'demo';

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
        const svc = await fetchJson<EnvServiceInfo>(
          `/api/services/${serviceId}?catalog=${catalog}`,
        );
        if (env && svc.urls?.[env]) {
          svc.url = svc.urls[env];
        } else if (env && svc.urls && !svc.urls[env]) {
          svc.urlFallback = true;
        }
        return svc;
      } catch {
        return null;
      }
    },
    async resolveAll(env) {
      const envParam = env ? `&env=${env}` : '';
      return fetchJson<Record<string, string>>(`/api/services/urls?catalog=${catalog}${envParam}`);
    },
    async listServices() {
      return fetchJson<EnvServiceInfo[]>(`/api/services?catalog=${catalog}`);
    },
  };
}
