/**
 * CatalogProvider — 카탈로그 접근 인터페이스.
 */

import type { Catalog } from "./catalog.types.js";

export interface CatalogInfo {
  readonly id: string;
  readonly name: string;
  readonly prefixCount: number;
}

export interface CatalogProvider {
  getCatalog(id?: string): Catalog;
  listCatalogs(): readonly CatalogInfo[];
}
