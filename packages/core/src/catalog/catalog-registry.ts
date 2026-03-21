/**
 * CatalogRegistry — 멀티 카탈로그 인메모리 레지스트리.
 *
 * CatalogProvider 구현. O(1) 조회. 여러 카탈로그를 독립적으로 등록/조회/관리.
 */

import type { Catalog } from "./catalog.types.js";
import type { CatalogProvider, CatalogInfo } from "./catalog-provider.js";

export class CatalogRegistry implements CatalogProvider {
  private readonly catalogs = new Map<string, Catalog>();
  private defaultId: string | null = null;

  /** 카탈로그 등록. 동일 id 재등록 시 덮어쓰기. */
  register(catalog: Catalog): void {
    this.catalogs.set(catalog.id, catalog);
    // 첫 등록이면 기본값으로 설정
    if (this.defaultId === null) {
      this.defaultId = catalog.id;
    }
  }

  /** 카탈로그 해제. 기본 카탈로그 해제 시 defaultId도 초기화. */
  unregister(id: string): void {
    this.catalogs.delete(id);
    if (this.defaultId === id) {
      // 남은 카탈로그 중 첫 번째를 기본값으로, 없으면 null
      const first = this.catalogs.keys().next();
      this.defaultId = first.done ? null : first.value;
    }
  }

  /** 기본 카탈로그 지정. 등록되지 않은 id면 에러. */
  setDefault(id: string): void {
    if (!this.catalogs.has(id)) {
      throw new Error(`Cannot set default: catalog '${id}' not registered`);
    }
    this.defaultId = id;
  }

  /** 카탈로그 조회. id 생략 시 기본 카탈로그 반환. */
  getCatalog(id?: string): Catalog {
    const targetId = id ?? this.defaultId;
    if (targetId === null) {
      throw new Error("No catalogs registered");
    }
    const catalog = this.catalogs.get(targetId);
    if (!catalog) {
      const available = [...this.catalogs.keys()].join(", ");
      throw new Error(`Catalog '${targetId}' not found. Available: ${available}`);
    }
    return catalog;
  }

  /** 등록된 모든 카탈로그 정보 목록. */
  listCatalogs(): readonly CatalogInfo[] {
    return [...this.catalogs.values()].map((c) => ({
      id: c.id,
      name: c.name,
      prefixCount: Object.keys(c.prefixes).length,
    }));
  }

  /** 카탈로그 존재 여부. */
  has(id: string): boolean {
    return this.catalogs.has(id);
  }

  /** 등록된 카탈로그 ID Set (주소 파서에서 사용). */
  get knownIds(): ReadonlySet<string> {
    return new Set(this.catalogs.keys());
  }

  /** 현재 기본 카탈로그 ID (없으면 null). */
  get currentDefaultId(): string | null {
    return this.defaultId;
  }
}
