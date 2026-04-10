import type {
  AxisSchema,
  OperationalOntologySchema,
  OperationalOntologySchemaRegistry,
  RelationCategoryRegistry,
  RelationCategorySchema,
  SchemaValidationResult,
  TaxonomySchema,
  TraversalSchema,
} from "./schema-core.js";
import { validateOperationalOntologySchema } from "./schema-core.js";

export interface InMemoryOperationalOntologySchemaRegistryOptions {
  allowInvalid?: boolean;
}

export class InMemoryOperationalOntologySchemaRegistry
  implements OperationalOntologySchemaRegistry, RelationCategoryRegistry
{
  private schema: OperationalOntologySchema;

  constructor(
    initialSchema: OperationalOntologySchema = {
      axes: [],
      taxonomies: [],
      relationCategories: [],
      traversals: [],
    },
    private readonly options: InMemoryOperationalOntologySchemaRegistryOptions = {},
  ) {
    this.schema = structuredClone(initialSchema);
  }

  load(): OperationalOntologySchema {
    return structuredClone(this.schema);
  }

  validate(schema: OperationalOntologySchema = this.schema): SchemaValidationResult {
    return validateOperationalOntologySchema(schema);
  }

  replace(schema: OperationalOntologySchema): SchemaValidationResult {
    const cloned = structuredClone(schema);
    const validation = validateOperationalOntologySchema(cloned);

    if (!validation.valid && !this.options.allowInvalid) {
      throw new Error(
        `Operational ontology schema is invalid: ${validation.issues
          .filter((issue) => issue.level === "error")
          .map((issue) => `${issue.code}@${issue.path}`)
          .join(", ")}`,
      );
    }

    this.schema = cloned;
    return validation;
  }

  get(category: string): RelationCategorySchema | undefined {
    return this.schema.relationCategories.find(
      (definition) => definition.category === category,
    );
  }

  getAxis(axisId: string): AxisSchema | undefined {
    return this.schema.axes.find((axis) => axis.id === axisId);
  }

  getTaxonomy(taxonomyId: string): TaxonomySchema | undefined {
    return this.schema.taxonomies.find((taxonomy) => taxonomy.id === taxonomyId);
  }

  getTraversal(purpose: string): TraversalSchema | undefined {
    return this.schema.traversals?.find((traversal) => traversal.purpose === purpose);
  }
}
