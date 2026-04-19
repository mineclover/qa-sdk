// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { randomUUID } from "node:crypto";

import type { DataObjectBinding, FieldRef } from "@qa-sdk/core";
import { desc, eq } from "drizzle-orm";

import { createDb, type DrizzleDb } from "./db/connection.js";
import { dataObjectBindings, lineageValidations } from "./db/schema.js";

export interface StoredDataObjectBinding {
  readonly schemaId: string;
  readonly prefixId: string;
  readonly prefixVersion: string;
  readonly columnToAxis: DataObjectBinding["columnToAxis"];
  readonly createdAt: string;
}

export type DataObjectBindingInput = Pick<
  DataObjectBinding,
  "schemaId" | "prefixId" | "prefixVersion" | "columnToAxis"
>;

export type LineageValidationStatus = "bound" | "unbound" | "mismatched";

export interface LineageValidationDetail {
  readonly status: LineageValidationStatus;
  readonly target: FieldRef;
  readonly sources: readonly FieldRef[];
  readonly pipeId?: string;
  readonly stepPath?: string;
  readonly reason?: string;
}

export interface LineageValidationSummary {
  readonly bound: number;
  readonly unbound: number;
  readonly mismatched: number;
}

export interface LineageValidationRecord extends LineageValidationSummary {
  readonly id: string;
  readonly schemaId: string;
  readonly validatedAt: string;
  readonly details: readonly LineageValidationDetail[];
}

export interface LineageValidationInput extends LineageValidationSummary {
  readonly id?: string;
  readonly schemaId: string;
  readonly validatedAt?: string;
  readonly details: readonly LineageValidationDetail[];
}

export class SqliteBindingStore {
  private db: DrizzleDb;

  constructor(pathOrDb: string | DrizzleDb) {
    if (typeof pathOrDb === "string") {
      const { db } = createDb(pathOrDb);
      this.db = db;
    } else {
      this.db = pathOrDb;
    }
  }

  save(binding: DataObjectBindingInput): StoredDataObjectBinding {
    this.db
      .insert(dataObjectBindings)
      .values({
        schemaId: binding.schemaId,
        prefixId: binding.prefixId,
        prefixVersion: binding.prefixVersion,
        columnToAxis: JSON.stringify(binding.columnToAxis),
      })
      .onConflictDoUpdate({
        target: dataObjectBindings.schemaId,
        set: {
          prefixId: binding.prefixId,
          prefixVersion: binding.prefixVersion,
          columnToAxis: JSON.stringify(binding.columnToAxis),
        },
      })
      .run();

    const saved = this.get(binding.schemaId);
    if (!saved) {
      throw new Error(`binding "${binding.schemaId}" 저장 후 재조회 실패`);
    }
    return saved;
  }

  get(schemaId: string): StoredDataObjectBinding | null {
    const row = this.db
      .select()
      .from(dataObjectBindings)
      .where(eq(dataObjectBindings.schemaId, schemaId))
      .get();
    return row ? rowToBinding(row) : null;
  }

  list(): StoredDataObjectBinding[] {
    return this.db
      .select()
      .from(dataObjectBindings)
      .orderBy(dataObjectBindings.schemaId)
      .all()
      .map(rowToBinding);
  }

  remove(schemaId: string): boolean {
    const result = this.db
      .delete(dataObjectBindings)
      .where(eq(dataObjectBindings.schemaId, schemaId))
      .run();
    return result.changes > 0;
  }
}

export class SqliteLineageValidationStore {
  private db: DrizzleDb;

  constructor(pathOrDb: string | DrizzleDb) {
    if (typeof pathOrDb === "string") {
      const { db } = createDb(pathOrDb);
      this.db = db;
    } else {
      this.db = pathOrDb;
    }
  }

  save(validation: LineageValidationInput): LineageValidationRecord {
    const validatedAt = validation.validatedAt ?? new Date().toISOString();
    const id = validation.id ?? randomUUID();

    this.db
      .insert(lineageValidations)
      .values({
        id,
        schemaId: validation.schemaId,
        validatedAt,
        bound: validation.bound,
        unbound: validation.unbound,
        mismatched: validation.mismatched,
        details: JSON.stringify(validation.details),
      })
      .run();

    const saved = this.db
      .select()
      .from(lineageValidations)
      .where(eq(lineageValidations.id, id))
      .get();
    if (!saved) {
      throw new Error(`lineage validation "${id}" 저장 후 재조회 실패`);
    }
    return rowToLineageValidation(saved);
  }

  getLatest(schemaId: string): LineageValidationRecord | null {
    const row = this.db
      .select()
      .from(lineageValidations)
      .where(eq(lineageValidations.schemaId, schemaId))
      .orderBy(desc(lineageValidations.validatedAt), desc(lineageValidations.id))
      .get();
    return row ? rowToLineageValidation(row) : null;
  }

  listBySchema(schemaId: string): LineageValidationRecord[] {
    return this.db
      .select()
      .from(lineageValidations)
      .where(eq(lineageValidations.schemaId, schemaId))
      .orderBy(desc(lineageValidations.validatedAt), desc(lineageValidations.id))
      .all()
      .map(rowToLineageValidation);
  }
}

type BindingRow = typeof dataObjectBindings.$inferSelect;
type LineageValidationRow = typeof lineageValidations.$inferSelect;

function rowToBinding(row: BindingRow): StoredDataObjectBinding {
  return {
    schemaId: row.schemaId,
    prefixId: row.prefixId,
    prefixVersion: row.prefixVersion,
    columnToAxis: JSON.parse(row.columnToAxis) as DataObjectBinding["columnToAxis"],
    createdAt: row.createdAt,
  };
}

function rowToLineageValidation(row: LineageValidationRow): LineageValidationRecord {
  return {
    id: row.id,
    schemaId: row.schemaId,
    validatedAt: row.validatedAt,
    bound: row.bound,
    unbound: row.unbound,
    mismatched: row.mismatched,
    details: JSON.parse(row.details) as LineageValidationDetail[],
  };
}
