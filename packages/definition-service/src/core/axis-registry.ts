/**
 * AxisRegistry — registry-service에서 definition 축 값을 가져와 캐싱
 *
 * DB가 메타데이터 SSOT이므로, 유효 값 검증은 registry-service의 축 entries로 수행.
 * fail-open: registry 미응답 시 로컬 캐시(DEFINITION_CATALOG 하드코딩) 사용.
 */

import {
  DEF_SCOPE,
  DEF_ASPECT,
  DEF_DEPTH,
  DEF_LIFECYCLE,
  LINK_TYPE,
} from "definition-catalog";

/** 축 entries 캐시 */
export interface AxisEntries {
  readonly scopes: readonly string[];
  readonly aspects: readonly string[];
  readonly depths: readonly string[];
  readonly lifecycles: readonly string[];
  readonly linkTypes: readonly string[];
  readonly source: "registry" | "local";
}

/** 로컬 폴백 (definition-catalog 패키지의 하드코딩 값) */
const LOCAL_ENTRIES: AxisEntries = {
  scopes: DEF_SCOPE.entries,
  aspects: DEF_ASPECT.entries,
  depths: DEF_DEPTH.entries,
  lifecycles: DEF_LIFECYCLE.entries,
  linkTypes: LINK_TYPE.entries,
  source: "local",
};

export class AxisRegistry {
  private cache: AxisEntries = LOCAL_ENTRIES;
  private lastFetchAt = 0;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly registryUrl: string,
    private readonly catalogId = "definition",
    options?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = options?.cacheTtlMs ?? 60_000;
  }

  /** 현재 캐시된 entries 반환 (expired면 백그라운드 refresh) */
  getEntries(): AxisEntries {
    if (Date.now() - this.lastFetchAt > this.cacheTtlMs) {
      void this.refresh();
    }
    return this.cache;
  }

  /** registry-service에서 축 entries fetch + 캐시 갱신 */
  async refresh(): Promise<AxisEntries> {
    try {
      const url = `${this.registryUrl}/catalogs/${this.catalogId}/axes`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`registry ${res.status}`);

      const axes = await res.json() as Array<{
        id: string;
        entryCount: number;
        capacity: number;
      }>;

      // 축별 entries는 catalog JSON에서 가져와야 함
      const catalogUrl = `${this.registryUrl}/catalogs/${this.catalogId}`;
      const catalogRes = await fetch(catalogUrl, { signal: AbortSignal.timeout(5_000) });
      if (!catalogRes.ok) throw new Error(`catalog ${catalogRes.status}`);

      const catalog = await catalogRes.json() as { data: string };
      const parsed = JSON.parse(catalog.data) as {
        axes: Record<string, { versions: Record<string, { entries: string[] }> }>;
      };

      const getEntries = (axisId: string): readonly string[] => {
        const axis = parsed.axes[axisId];
        if (!axis) return [];
        const versions = Object.values(axis.versions);
        return versions[versions.length - 1]?.entries ?? [];
      };

      this.cache = {
        scopes: getEntries("def_scope"),
        aspects: getEntries("def_aspect"),
        depths: getEntries("def_depth"),
        lifecycles: getEntries("def_lifecycle"),
        linkTypes: getEntries("link_type"),
        source: "registry",
      };
      this.lastFetchAt = Date.now();

      return this.cache;
    } catch {
      // fail-open: 로컬 캐시 유지
      this.lastFetchAt = Date.now();
      return this.cache;
    }
  }

  /** 값이 유효한 scope인지 */
  isValidScope(value: string): boolean {
    return this.cache.scopes.includes(value);
  }

  isValidAspect(value: string): boolean {
    return this.cache.aspects.includes(value);
  }

  isValidDepth(value: string): boolean {
    return this.cache.depths.includes(value);
  }

  isValidLifecycle(value: string): boolean {
    return this.cache.lifecycles.includes(value);
  }

  isValidLinkType(value: string): boolean {
    return this.cache.linkTypes.includes(value);
  }

  /** 메타데이터 전체 검증 — 실패한 필드 목록 반환 */
  validateMetadata(meta: {
    scope?: string;
    aspect?: string;
    depth?: string;
    lifecycle?: string;
  }): string[] {
    const errors: string[] = [];
    if (meta.scope && !this.isValidScope(meta.scope)) {
      errors.push(`scope '${meta.scope}' is not valid. valid: ${this.cache.scopes.join(", ")}`);
    }
    if (meta.aspect && !this.isValidAspect(meta.aspect)) {
      errors.push(`aspect '${meta.aspect}' is not valid. valid: ${this.cache.aspects.join(", ")}`);
    }
    if (meta.depth && !this.isValidDepth(meta.depth)) {
      errors.push(`depth '${meta.depth}' is not valid. valid: ${this.cache.depths.join(", ")}`);
    }
    if (meta.lifecycle && !this.isValidLifecycle(meta.lifecycle)) {
      errors.push(`lifecycle '${meta.lifecycle}' is not valid. valid: ${this.cache.lifecycles.join(", ")}`);
    }
    return errors;
  }
}
