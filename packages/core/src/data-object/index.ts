export type {
  ColumnAxisMapping,
  DataObjectBinding,
  BindingValidation,
  LineageChainValidation,
  ChainIssueKind,
  ChainIssue,
  DetailedChainValidation,
  BoundDataObject,
  FacetCodeRef,
  FacetCodeMapping,
} from "./types.js";
export { BindingRegistry } from "./registry.js";
export { validateBindings, validateLineageChain, validateLineageChainDetailed } from "./validate.js";
export { FacetCodeRegistry, resolveFacetMappings } from "./facet-code-registry.js";
export type { FacetCodeStore, FacetResolution } from "./facet-code-registry.js";
export { buildFullLineageChain } from "./lineage-chain.js";
export type { LineageChainNode, FullLineageChain } from "./lineage-chain.js";
