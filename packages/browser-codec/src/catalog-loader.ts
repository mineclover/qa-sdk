/** @def.boundary browser-runtime-system */
/**
 * CatalogLoader — 런타임에 catalog을 API에서 로드.
 *
 * 3가지 소스:
 *   1. API (실시간): registry-service /resolve/active
 *   2. Static (빌드): BROWSER_CATALOG (내장 사본)
 *   3. Cache (오프라인): localStorage 캐시
 *
 * 순서: API 시도 → 실패 시 Cache → 실패 시 Static fallback
 */

import type {
  BrowserCatalog,
  BrowserPrefixDef,
  BrowserDimDef,
  BrowserServiceDims,
} from './browser-codec.js';
import { withServiceOverlay } from './browser-codec.js';
import { BROWSER_CATALOG } from './demo-catalog-browser.js';

export interface CatalogLoaderConfig {
  /** registry-service URL (예: "http://localhost:4000") */
  readonly registryUrl?: string;
  /** localStorage 캐시 키 */
  readonly cacheKey?: string;
  /** 캐시 만료 시간 (ms, 기본: 5분) */
  readonly cacheTtlMs?: number;
  /** API 타임아웃 (ms, 기본: 5초) */
  readonly timeoutMs?: number;
  /** service prefix를 로컬 browser catalog overlay로 확장할 값 */
  readonly serviceOverlay?: BrowserServiceDims;
}

export interface LoadResult {
  readonly catalog: BrowserCatalog;
  readonly source: 'api' | 'cache' | 'static';
  readonly prefixCount: number;
  readonly timestamp: string;
}

/**
 * catalog을 로드한다.
 * API → Cache → Static 순서로 시도.
 */
export async function loadCatalog(config?: CatalogLoaderConfig): Promise<LoadResult> {
  const cacheKey = config?.cacheKey ?? 'qa-sdk-catalog';
  const cacheTtl = config?.cacheTtlMs ?? 5 * 60 * 1000;
  const timeout = config?.timeoutMs ?? 5000;

  // 1. API 시도
  if (config?.registryUrl) {
    try {
      const catalog = await fetchCatalog(config.registryUrl, timeout);
      if (catalog && Object.keys(catalog).length > 0) {
        const overlaidCatalog = applyServiceOverlay(catalog, config?.serviceOverlay);
        // 캐시 저장
        saveCatalogCache(cacheKey, overlaidCatalog);
        return {
          catalog: overlaidCatalog,
          source: 'api',
          prefixCount: Object.keys(overlaidCatalog).length,
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // API 실패 → cache로 fallback
    }
  }

  // 2. Cache 시도
  const cached = loadCatalogCache(cacheKey, cacheTtl);
  if (cached) {
    const overlaidCatalog = applyServiceOverlay(cached, config?.serviceOverlay);
    return {
      catalog: overlaidCatalog,
      source: 'cache',
      prefixCount: Object.keys(overlaidCatalog).length,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Static fallback
  const overlaidStaticCatalog = applyServiceOverlay(BROWSER_CATALOG, config?.serviceOverlay);
  return {
    catalog: overlaidStaticCatalog,
    source: 'static',
    prefixCount: Object.keys(overlaidStaticCatalog).length,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════
//  API Fetch
// ═══════════════════════════════════════════════════

async function fetchCatalog(
  registryUrl: string,
  timeoutMs: number,
): Promise<BrowserCatalog | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${registryUrl}/resolve/active`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    return convertRegistryResponse(data);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** registry-service 응답의 dim 형태 */
interface RegistryDimData {
  readonly kind?: string;
  readonly entries?: readonly string[];
  readonly capacity?: number;
  readonly values?: readonly number[];
}

/** registry-service 응답의 prefix 형태 */
interface RegistryPrefixData {
  readonly version?: string;
  readonly activeVersion?: string;
  readonly labels?: string[];
  readonly dims?: Record<string, RegistryDimData>;
}

/**
 * registry-service /resolve/active 응답을 BrowserCatalog로 변환.
 *
 * 응답 형태 (예상):
 * { prefixId: { version, dims: { label: { kind, entries?, capacity?, values? } }, ... }, ... }
 */
function convertRegistryResponse(data: Record<string, unknown>): BrowserCatalog {
  const catalog: Record<string, BrowserPrefixDef> = {};

  for (const [prefixId, raw] of Object.entries(data)) {
    if (!raw || typeof raw !== 'object') continue;
    const prefixData = raw as RegistryPrefixData;

    const version = prefixData.version ?? prefixData.activeVersion ?? 'v1';
    const labels: string[] =
      prefixData.labels ?? (prefixData.dims ? Object.keys(prefixData.dims) : []);
    const dims: Record<string, BrowserDimDef> = {};

    if (prefixData.dims) {
      for (const [label, dimData] of Object.entries(prefixData.dims)) {
        if (dimData.kind === 'axis' || dimData.entries) {
          dims[label] = {
            kind: 'axis',
            entries: dimData.entries ?? [],
            capacity: dimData.capacity ?? dimData.entries?.length ?? 32,
          };
        } else if (dimData.kind === 'prefix_ref' || dimData.values) {
          dims[label] = {
            kind: 'prefix_ref',
            values: dimData.values ?? [],
          };
        }
        // table_ref는 encode에 불필요하므로 건너뜀
      }
    }

    if (labels.length > 0 || Object.keys(dims).length > 0) {
      catalog[prefixId] = { version, labels, dims };
    }
  }

  return catalog;
}

// ═══════════════════════════════════════════════════
//  LocalStorage Cache
// ═══════════════════════════════════════════════════

interface CacheEntry {
  catalog: BrowserCatalog;
  savedAt: number;
}

function saveCatalogCache(key: string, catalog: BrowserCatalog): void {
  try {
    const entry: CacheEntry = { catalog, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage 불가 (private mode 등)
  }
}

function loadCatalogCache(key: string, ttlMs: number): BrowserCatalog | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > ttlMs) return null; // 만료
    return entry.catalog;
  } catch {
    return null;
  }
}

function applyServiceOverlay(
  catalog: BrowserCatalog,
  serviceOverlay?: BrowserServiceDims,
): BrowserCatalog {
  if (!serviceOverlay) {
    return catalog;
  }

  try {
    return withServiceOverlay(catalog, serviceOverlay);
  } catch {
    return catalog;
  }
}
