// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type DecisionServiceDatabase } from '../../database.module.js';
import {
  flowSchemas,
  type FlowSchemaGate,
  type FlowSchemaOutcome,
  type FlowSchemaRow,
} from '../../db/schema.js';

export interface FlowSchemaRecord {
  schemaId: string;
  name: string;
  description?: string;
  version: string;
  gates: FlowSchemaGate[];
  outcomes: FlowSchemaOutcome[];
  meta: Record<string, unknown>;
  registeredAt: string;
  updatedAt: string;
}

function rowToSchema(row: FlowSchemaRow): FlowSchemaRecord {
  return {
    ...row,
    description: row.description ?? undefined,
  };
}

@Injectable()
export class SchemasService {
  constructor(@Inject(DATABASE) private readonly db: DecisionServiceDatabase) {}

  register(input: {
    schemaId: string;
    name: string;
    description?: string;
    version?: string;
    gates: FlowSchemaRecord['gates'];
    outcomes?: FlowSchemaRecord['outcomes'];
    meta?: Record<string, unknown>;
  }): FlowSchemaRecord {
    const now = new Date().toISOString();
    const values = {
      schemaId: input.schemaId,
      name: input.name,
      description: input.description ?? null,
      version: input.version ?? 'v1',
      gates: input.gates,
      outcomes: input.outcomes ?? [],
      meta: input.meta ?? {},
      registeredAt: now,
      updatedAt: now,
    };

    this.db
      .insert(flowSchemas)
      .values(values)
      .onConflictDoUpdate({
        target: flowSchemas.schemaId,
        set: {
          name: values.name,
          description: values.description,
          version: values.version,
          gates: values.gates,
          outcomes: values.outcomes,
          meta: values.meta,
          updatedAt: values.updatedAt,
        },
      })
      .run();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- row was just inserted/upserted above
    return this.get(input.schemaId)!;
  }

  get(schemaId: string): FlowSchemaRecord | null {
    const row = this.db.select().from(flowSchemas).where(eq(flowSchemas.schemaId, schemaId)).get();
    return row ? rowToSchema(row) : null;
  }

  list(): FlowSchemaRecord[] {
    return this.db.select().from(flowSchemas).orderBy(flowSchemas.schemaId).all().map(rowToSchema);
  }

  delete(schemaId: string): boolean {
    const result = this.db.delete(flowSchemas).where(eq(flowSchemas.schemaId, schemaId)).run();
    return result.changes > 0;
  }
}
