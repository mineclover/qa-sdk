import type { AxisIR, RelationIR, ConstraintIR, ImportIR } from 'taxonomy-engine';

// taxonomy-engine IR을 JSON 직렬화한 형태 (Map → object)
export type StaticTaxonomy = {
  taxonomy: string;
  version: number;
  description?: string;
  contentHash: string;
  axes: Record<string, AxisIR>; // Map<>이 object로
  relations: Record<string, RelationIR>;
  constraints: ConstraintIR[];
  imports: ImportIR[];
};

export type TaxonomyIndex = {
  taxonomies: Array<{
    name: string;
    file: string;
    version: number;
    contentHash: string;
    axesCount: number;
    relationsCount: number;
    constraintsCount: number;
  }>;
};
