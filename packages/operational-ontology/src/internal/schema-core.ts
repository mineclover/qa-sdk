export type CoordAxes = Record<string, string>;

export interface AxisSchema {
  id: string;
  values: string[];
  extensible?: boolean;
  stable?: boolean;
  capacity?: number;
}

export interface TaxonomySchema {
  id: string;
  appliesTo: string[];
  axisIds: string[];
  identityAxisIds?: string[];
  space?: string;
}

export interface RelationCategoryDef {
  category: string;
  requiredAxes: string[];
  optionalAxes?: string[];
  forbiddenAxes?: string[];
  defaultValues?: CoordAxes;
  allowedStartKinds?: string[];
  allowedEndKinds?: string[];
  compositionRule?: string;
  validationRule?: string;
}

export interface RelationCategorySchema extends RelationCategoryDef {}

export interface TraversalSchema {
  purpose: string;
  allowedRelationCategories?: string[];
  allowedEdgeKinds?: string[];
  canonicalizable?: boolean;
}

export interface OperationalOntologySchema {
  axes: AxisSchema[];
  taxonomies: TaxonomySchema[];
  relationCategories: RelationCategorySchema[];
  traversals?: TraversalSchema[];
}

export interface OperationalOntologySchemaRegistry {
  load(): OperationalOntologySchema;
}

export interface RelationCategoryRegistry {
  get(category: string): RelationCategorySchema | undefined;
}

export type RelationCategoryResolver =
  | RelationCategoryRegistry
  | ((category: string) => RelationCategorySchema | undefined);

export interface RelationAxisValidation {
  valid: boolean;
  missing: string[];
  forbidden: string[];
  unexpected: string[];
}

export interface SchemaValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  issues: SchemaValidationIssue[];
}

function createIssue(
  level: "error" | "warning",
  code: string,
  message: string,
  path: string,
): SchemaValidationIssue {
  return { level, code, message, path };
}

function finalizeIssues(issues: SchemaValidationIssue[]): SchemaValidationResult {
  return {
    valid: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}

export function applyRelationDefaults(
  definition: RelationCategorySchema,
  axes: CoordAxes,
): CoordAxes {
  return {
    ...(definition.defaultValues ?? {}),
    ...axes,
  };
}

export function validateRelationAxes(
  definition: RelationCategorySchema,
  axes: CoordAxes,
): RelationAxisValidation {
  const required = new Set(definition.requiredAxes);
  const optional = new Set(definition.optionalAxes ?? []);
  const forbidden = new Set(definition.forbiddenAxes ?? []);

  const missing = [...required].filter((key) => !(key in axes));
  const forbiddenKeys = [...forbidden].filter((key) => key in axes);
  const unexpected = Object.keys(axes).filter(
    (key) => !required.has(key) && !optional.has(key) && !forbidden.has(key),
  );

  return {
    valid: missing.length === 0 && forbiddenKeys.length === 0 && unexpected.length === 0,
    missing,
    forbidden: forbiddenKeys,
    unexpected,
  };
}

export function resolveRelationCategory(
  resolver: RelationCategoryResolver,
  category: string,
): RelationCategorySchema | undefined {
  if (typeof resolver === "function") {
    return resolver(category);
  }

  return resolver.get(category);
}

export function validateAxisSchema(axis: AxisSchema): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const uniqueValues = new Set(axis.values);

  if (axis.id.trim().length === 0) {
    issues.push(createIssue("error", "axis-id-empty", "Axis id must not be empty", "axis.id"));
  }

  if (axis.values.length === 0) {
    issues.push(
      createIssue("error", "axis-values-empty", "Axis must define at least one value", `${axis.id}.values`),
    );
  }

  if (uniqueValues.size !== axis.values.length) {
    issues.push(
      createIssue(
        "error",
        "axis-values-duplicate",
        "Axis values must be unique",
        `${axis.id}.values`,
      ),
    );
  }

  if (typeof axis.capacity === "number" && axis.capacity < axis.values.length) {
    issues.push(
      createIssue(
        "error",
        "axis-capacity-too-small",
        "Axis capacity must be greater than or equal to the number of values",
        `${axis.id}.capacity`,
      ),
    );
  }

  return finalizeIssues(issues);
}

export function validateTaxonomySchema(
  taxonomy: TaxonomySchema,
  axes: Map<string, AxisSchema>,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const uniqueAxisIds = new Set(taxonomy.axisIds);
  const identityAxisIds = taxonomy.identityAxisIds ?? [];

  if (taxonomy.id.trim().length === 0) {
    issues.push(
      createIssue("error", "taxonomy-id-empty", "Taxonomy id must not be empty", "taxonomy.id"),
    );
  }

  if (taxonomy.axisIds.length === 0) {
    issues.push(
      createIssue(
        "error",
        "taxonomy-axes-empty",
        "Taxonomy must reference at least one axis",
        `${taxonomy.id}.axisIds`,
      ),
    );
  }

  if (uniqueAxisIds.size !== taxonomy.axisIds.length) {
    issues.push(
      createIssue(
        "error",
        "taxonomy-axes-duplicate",
        "Taxonomy axisIds must be unique",
        `${taxonomy.id}.axisIds`,
      ),
    );
  }

  for (const axisId of taxonomy.axisIds) {
    if (!axes.has(axisId)) {
      issues.push(
        createIssue(
          "error",
          "taxonomy-axis-missing",
          `Taxonomy references unknown axis "${axisId}"`,
          `${taxonomy.id}.axisIds`,
        ),
      );
    }
  }

  for (const axisId of identityAxisIds) {
    if (!uniqueAxisIds.has(axisId)) {
      issues.push(
        createIssue(
          "error",
          "taxonomy-identity-axis-missing",
          `identityAxisIds entry "${axisId}" must also exist in axisIds`,
          `${taxonomy.id}.identityAxisIds`,
        ),
      );
    }
  }

  return finalizeIssues(issues);
}

export function validateRelationCategorySchema(
  definition: RelationCategorySchema,
  axes: Map<string, AxisSchema>,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const allReferencedAxes = [
    ...definition.requiredAxes,
    ...(definition.optionalAxes ?? []),
    ...(definition.forbiddenAxes ?? []),
  ];
  const uniqueAxes = new Set(allReferencedAxes);

  if (definition.category.trim().length === 0) {
    issues.push(
      createIssue(
        "error",
        "relation-category-empty",
        "Relation category must not be empty",
        "relation.category",
      ),
    );
  }

  if (definition.requiredAxes.length === 0) {
    issues.push(
      createIssue(
        "warning",
        "relation-required-axes-empty",
        "Relation category should define at least one required axis",
        `${definition.category}.requiredAxes`,
      ),
    );
  }

  if (uniqueAxes.size !== allReferencedAxes.length) {
    issues.push(
      createIssue(
        "error",
        "relation-axes-overlap",
        "Relation category axes must not overlap across required/optional/forbidden",
        `${definition.category}.axes`,
      ),
    );
  }

  for (const axisId of allReferencedAxes) {
    if (!axes.has(axisId)) {
      issues.push(
        createIssue(
          "error",
          "relation-axis-missing",
          `Relation category references unknown axis "${axisId}"`,
          `${definition.category}.axes`,
        ),
      );
    }
  }

  return finalizeIssues(issues);
}

export function validateTraversalSchema(
  traversal: TraversalSchema,
  relationCategories: Map<string, RelationCategorySchema>,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];

  if (traversal.purpose.trim().length === 0) {
    issues.push(
      createIssue(
        "error",
        "traversal-purpose-empty",
        "Traversal purpose must not be empty",
        "traversal.purpose",
      ),
    );
  }

  for (const category of traversal.allowedRelationCategories ?? []) {
    if (!relationCategories.has(category)) {
      issues.push(
        createIssue(
          "error",
          "traversal-relation-category-missing",
          `Traversal references unknown relation category "${category}"`,
          `${traversal.purpose}.allowedRelationCategories`,
        ),
      );
    }
  }

  return finalizeIssues(issues);
}

export function validateOperationalOntologySchema(
  schema: OperationalOntologySchema,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const axisMap = new Map<string, AxisSchema>();
  const taxonomyIds = new Set<string>();
  const relationCategoryMap = new Map<string, RelationCategorySchema>();
  const traversalPurposes = new Set<string>();

  for (const axis of schema.axes) {
    if (axisMap.has(axis.id)) {
      issues.push(
        createIssue("error", "axis-id-duplicate", `Duplicate axis id "${axis.id}"`, `axes.${axis.id}`),
      );
    } else {
      axisMap.set(axis.id, axis);
    }

    issues.push(...validateAxisSchema(axis).issues);
  }

  for (const taxonomy of schema.taxonomies) {
    if (taxonomyIds.has(taxonomy.id)) {
      issues.push(
        createIssue(
          "error",
          "taxonomy-id-duplicate",
          `Duplicate taxonomy id "${taxonomy.id}"`,
          `taxonomies.${taxonomy.id}`,
        ),
      );
    } else {
      taxonomyIds.add(taxonomy.id);
    }

    issues.push(...validateTaxonomySchema(taxonomy, axisMap).issues);
  }

  for (const definition of schema.relationCategories) {
    if (relationCategoryMap.has(definition.category)) {
      issues.push(
        createIssue(
          "error",
          "relation-category-duplicate",
          `Duplicate relation category "${definition.category}"`,
          `relationCategories.${definition.category}`,
        ),
      );
    } else {
      relationCategoryMap.set(definition.category, definition);
    }

    issues.push(...validateRelationCategorySchema(definition, axisMap).issues);
  }

  for (const traversal of schema.traversals ?? []) {
    if (traversalPurposes.has(traversal.purpose)) {
      issues.push(
        createIssue(
          "error",
          "traversal-purpose-duplicate",
          `Duplicate traversal purpose "${traversal.purpose}"`,
          `traversals.${traversal.purpose}`,
        ),
      );
    } else {
      traversalPurposes.add(traversal.purpose);
    }

    issues.push(...validateTraversalSchema(traversal, relationCategoryMap).issues);
  }

  return finalizeIssues(issues);
}
