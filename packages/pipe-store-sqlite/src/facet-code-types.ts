// @def.boundary persistence-system-root
// @def.doc persistence-system-root

export interface FacetCodeRef {
  file: string;
  symbol?: string;
  lines?: [number, number];
}

export interface FacetCodeMapping {
  facet: string;
  implementations: FacetCodeRef[];
  schemaId?: string;
}

export interface FacetCodeStore {
  register(mapping: FacetCodeMapping): void;
  getByFacet(facet: string): FacetCodeMapping | null;
  getByFile(file: string): FacetCodeMapping[];
  getBySchema(schemaId: string): FacetCodeMapping[];
  listAll(): FacetCodeMapping[];
  remove(facet: string): boolean;
}
