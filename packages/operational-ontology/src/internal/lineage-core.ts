import type { InformationFacetRef } from "./runtime-core.js";

export const LINEAGE_TRANSFORM_KINDS = [
  "direct",
  "rename",
  "compute",
  "aggregate",
  "lookup",
  "derive",
  "concat",
  "split",
  "filter",
  "cast",
] as const;

export type LineageTransformKind = (typeof LINEAGE_TRANSFORM_KINDS)[number];

export interface DataLineageLink {
  lineageId: string;
  target: InformationFacetRef;
  sources: InformationFacetRef[];
  transform: LineageTransformKind;
  expression?: string;
  transmissionRef?: string;
}

export function createDataLineageId(input: {
  target: InformationFacetRef;
  sources: InformationFacetRef[];
  transform: LineageTransformKind;
}): string {
  const sourceKeys = input.sources.map((source) => source.key).sort().join(",");
  return `lineage:${sourceKeys}->${input.transform}->${input.target.key}`;
}
