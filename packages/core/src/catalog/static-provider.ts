// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * StaticCatalogProvider — 단일 Catalog를 래핑하는 간단한 구현.
 */

import type { Catalog } from './catalog.types.js';
import type { CatalogProvider, CatalogInfo } from './catalog-provider.js';

export class StaticCatalogProvider implements CatalogProvider {
  private readonly catalog: Catalog;

  constructor(catalog: Catalog) {
    this.catalog = catalog;
  }

  getCatalog(id?: string): Catalog {
    if (id !== undefined && id !== this.catalog.id) {
      throw new Error(`Catalog '${id}' not found. Available: ${this.catalog.id}`);
    }
    return this.catalog;
  }

  listCatalogs(): readonly CatalogInfo[] {
    return [
      {
        id: this.catalog.id,
        name: this.catalog.name,
        prefixCount: Object.keys(this.catalog.prefixes).length,
      },
    ];
  }
}
