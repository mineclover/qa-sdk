// @def.boundary registry-system
// @def.doc registry-system

export interface CatalogRecord {
  readonly id: string;
  readonly name: string;
  /** Full Catalog JSON */
  readonly data: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogStore {
  register(record: CatalogRecord): Promise<void>;
  get(id: string): Promise<CatalogRecord | null>;
  list(): Promise<CatalogRecord[]>;
  update(id: string, name: string, data: string): Promise<void>;
  delete(id: string): Promise<void>;
}
