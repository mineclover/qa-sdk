import {
  validateAxisSchema,
  validateOperationalOntologySchema,
  validateRelationCategorySchema,
  validateTaxonomySchema,
  validateTraversalSchema,
} from "./internal/schema-core.js";
import {
  defaultCorridorTemplateRegistry,
  validateCorridorAgainstTemplate,
} from "./internal/corridor-core.js";
import { defaultJunctionTemplateRegistry } from "./internal/junction-core.js";
import { defaultCheckpointTemplateRegistry } from "./internal/checkpoint-core.js";
import {
  defaultObservationTopologyTemplateRegistry,
  validateObservationTopologyAgainstTemplate,
} from "./internal/topology-core.js";
import {
  createDefaultOperationalOntologyRuntimePorts,
  defaultOperationalOntologyRuntimePorts,
  inferLineageLinksFromPipe,
  projectEventRecordToOperationalOntology,
  projectLineageToOperationalOntology,
  projectOperationalOntologySnapshot,
  projectPathObservationToOperationalOntology,
  projectPipeGraphToOperationalOntology,
} from "./internal/projector-core.js";
import {
  getAllowedFacetKindsForObjectKind,
  getFacetPayloadShapeDescriptor,
  getOptionalFacetKindsForObjectKind,
  getRequiredFacetKindsForObjectKind,
  validateFacetKindsForObjectKind,
  validateFacetPayloadShape,
} from "./internal/persistence-core.js";

export * from "./internal/schema-core.js";
export * from "./internal/schema-memory.js";
export * from "./internal/runtime-core.js";
export * from "./internal/lineage-core.js";
export * from "./internal/corridor-core.js";
export * from "./internal/junction-core.js";
export * from "./internal/checkpoint-core.js";
export * from "./internal/topology-core.js";
export * from "./internal/projector-core.js";
export * from "./internal/persistence-core.js";
export * from "./internal/persistence-memory.js";
export * from "./internal/persistence-snapshot.js";
export * from "./internal/persistence-ingest.js";
export * from "./internal/persistence-query.js";
export * from "./internal/persistence-service.js";

// ── Architecture Facades ───────────────────────────────

export const operationalOntologySchemaPlane = {
  validateAxisSchema,
  validateTaxonomySchema,
  validateRelationCategorySchema,
  validateTraversalSchema,
  validateOperationalOntologySchema,
};

export const operationalOntologyCorridorPlane = {
  defaultCorridorTemplateRegistry,
  validateCorridorAgainstTemplate,
};

export const operationalOntologyLineagePlane = {
  projectLineageToOperationalOntology,
  inferLineageLinksFromPipe,
};

export const operationalOntologyJunctionPlane = {
  defaultJunctionTemplateRegistry,
  projectPathObservationToOperationalOntology,
};

export const operationalOntologyCheckpointPlane = {
  defaultCheckpointTemplateRegistry,
  projectEventRecordToOperationalOntology,
};

export const operationalOntologyTopologyPlane = {
  defaultObservationTopologyTemplateRegistry,
  validateObservationTopologyAgainstTemplate,
  projectOperationalOntologySnapshot,
};

export const operationalOntologyProjectors = {
  projectEventRecordToOperationalOntology,
  projectPipeGraphToOperationalOntology,
  projectLineageToOperationalOntology,
  projectPathObservationToOperationalOntology,
  projectOperationalOntologySnapshot,
  createDefaultOperationalOntologyRuntimePorts,
  defaultOperationalOntologyRuntimePorts,
};

export const operationalOntologyPersistencePlane = {
  getAllowedFacetKindsForObjectKind,
  getRequiredFacetKindsForObjectKind,
  getOptionalFacetKindsForObjectKind,
  validateFacetKindsForObjectKind,
  getFacetPayloadShapeDescriptor,
  validateFacetPayloadShape,
};
