/**
 * CatalogProvider — catalog 소비 경로 추상화.
 *
 * 핵심 컨벤션:
 *   1. Registry가 prefix/version/shape/stride의 authority
 *   2. SDK/CLI는 registry에서 active catalog을 조회하여 사용
 *   3. Fallback: registry 없으면 로컬 demo-snapshot 사용 (개발 모드)
 *
 * 사용:
 *   // 개발 (로컬 catalog)
 *   const provider = createCatalogProvider();
 *
 *   // 운영 (registry 기반)
 *   const provider = createCatalogProvider({ registry: "http://registry:3300" });
 *
 *   // 소비
 *   const catalog = await provider.getCatalog();
 *   const version = provider.latestVersion("permission");
 */

import type { Catalog } from "@qa-sdk/core";

export interface CatalogProvider {
  /** catalog 조회 (registry 또는 로컬) */
  getCatalog(): Promise<Catalog>;
  /** prefix의 최신 version */
  latestVersion(prefixId: string): string;
  /** 소스 식별자 */
  readonly source: "local" | "registry";
  /** registry URL (registry 모드일 때) */
  readonly registryUrl?: string;
}

export interface CatalogProviderConfig {
  /** registry URL. 없으면 로컬 모드. */
  registry?: string;
  /** 로컬 catalog (registry 없을 때 사용) */
  catalog?: Catalog;
  /** catalog ID (registry 모드에서 사용, default: "demo") */
  catalogId?: string;
}

/**
 * CatalogProvider 생성.
 *
 * registry 옵션이 있으면 → registry에서 fetch
 * 없으면 → 로컬 demo-snapshot 사용
 */
export function createCatalogProvider(config?: CatalogProviderConfig): CatalogProvider {
  if (config?.registry) {
    return createRegistryProvider(config.registry, config.catalogId ?? "demo");
  }
  return createLocalProvider(config?.catalog);
}

// ── Local Provider ──

function createLocalProvider(catalog?: Catalog): CatalogProvider {
  let _catalog: Catalog | null = catalog ?? null;

  return {
    source: "local",
    async getCatalog() {
      if (_catalog) return _catalog;
      try {
        const mod = await import("demo-snapshot");
        _catalog = mod.DEMO_CATALOG;
        return _catalog;
      } catch {
        throw new Error("DEMO_CATALOG not available. Pass catalog in config or set registry URL.");
      }
    },
    latestVersion(prefixId: string) {
      if (!_catalog) return "v1";
      const prefix = _catalog.prefixes[prefixId];
      if (!prefix?.versions?.length) return "v1";
      return prefix.versions[prefix.versions.length - 1].version;
    },
  };
}

// ── Registry Provider ──

function createRegistryProvider(registryUrl: string, catalogId: string): CatalogProvider {
  let _catalog: Catalog | null = null;

  return {
    source: "registry",
    registryUrl,
    async getCatalog() {
      if (_catalog) return _catalog;
      try {
        const res = await fetch(`${registryUrl}/catalogs/${catalogId}`);
        if (!res.ok) throw new Error(`Registry ${res.status}`);
        const body = await res.json() as { data: string };
        _catalog = JSON.parse(body.data) as Catalog;
        return _catalog;
      } catch (err: any) {
        // Fallback: 로컬 catalog
        console.warn(`Registry 연결 실패 (${registryUrl}): ${err.message}. 로컬 fallback.`);
        try {
          const mod = await import("demo-snapshot");
          _catalog = mod.DEMO_CATALOG;
          return _catalog;
        } catch {
          throw new Error("Registry 연결 실패 + 로컬 catalog 없음.");
        }
      }
    },
    latestVersion(prefixId: string) {
      if (!_catalog) return "v1";
      const prefix = _catalog.prefixes[prefixId];
      if (!prefix?.versions?.length) return "v1";
      return prefix.versions[prefix.versions.length - 1].version;
    },
  };
}
