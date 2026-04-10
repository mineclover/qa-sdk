export {
  type CoordAxes,
  type AxisSchema,
  type TaxonomySchema,
  type RelationCategoryDef,
  type RelationCategorySchema,
  type TraversalSchema,
  type OperationalOntologySchema,
  type OperationalOntologySchemaRegistry,
  type RelationCategoryRegistry,
  type RelationCategoryResolver,
  type RelationAxisValidation,
  type SchemaValidationIssue,
  type SchemaValidationResult,
  applyRelationDefaults,
  validateRelationAxes,
  resolveRelationCategory,
  validateAxisSchema,
  validateTaxonomySchema,
  validateRelationCategorySchema,
  validateTraversalSchema,
  validateOperationalOntologySchema,
} from "./internal/schema-core.js";

export {
  type InMemoryOperationalOntologySchemaRegistryOptions,
  InMemoryOperationalOntologySchemaRegistry,
} from "./internal/schema-memory.js";

import {
  validateAxisSchema,
  validateTaxonomySchema,
  validateRelationCategorySchema,
  validateTraversalSchema,
  validateOperationalOntologySchema,
} from "./internal/schema-core.js";

export const operationalOntologySchemaPlane = {
  validateAxisSchema,
  validateTaxonomySchema,
  validateRelationCategorySchema,
  validateTraversalSchema,
  validateOperationalOntologySchema,
};
