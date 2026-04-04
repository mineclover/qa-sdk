import { eq, like } from "drizzle-orm";

import { createDb, type DrizzleDb } from "./db/connection.js";
import { facetCodeMappings } from "./db/schema.js";
import type { FacetCodeMapping, FacetCodeRef, FacetCodeStore } from "./facet-code-types.js";

type MappingRow = typeof facetCodeMappings.$inferSelect;

/** SQLite 기반 FacetCodeStore 구현 */
export class SqliteFacetCodeStore implements FacetCodeStore {
  private db: DrizzleDb;

  constructor(pathOrDb: string | DrizzleDb) {
    if (typeof pathOrDb === "string") {
      const { db } = createDb(pathOrDb);
      this.db = db;
    } else {
      this.db = pathOrDb;
    }
  }

  register(mapping: FacetCodeMapping): void {
    const existing = this.db
      .select()
      .from(facetCodeMappings)
      .where(eq(facetCodeMappings.facet, mapping.facet))
      .get();

    if (existing) {
      throw new Error(`FacetCodeMapping already registered for facet: "${mapping.facet}"`);
    }

    this.db
      .insert(facetCodeMappings)
      .values({
        facet: mapping.facet,
        implementations: JSON.stringify(mapping.implementations),
        schemaId: mapping.schemaId ?? null,
      })
      .run();
  }

  getByFacet(facet: string): FacetCodeMapping | null {
    const row = this.db
      .select()
      .from(facetCodeMappings)
      .where(eq(facetCodeMappings.facet, facet))
      .get();
    return row ? rowToMapping(row) : null;
  }

  getByFile(file: string): FacetCodeMapping[] {
    // implementations JSON 컬럼에서 파일 경로 검색
    const rows = this.db
      .select()
      .from(facetCodeMappings)
      .where(like(facetCodeMappings.implementations, `%${escapeLike(file)}%`))
      .all();

    // JSON 파싱 후 정확한 file 매칭 필터
    return rows
      .map(rowToMapping)
      .filter(m => m.implementations.some(impl => impl.file === file));
  }

  getBySchema(schemaId: string): FacetCodeMapping[] {
    return this.db
      .select()
      .from(facetCodeMappings)
      .where(eq(facetCodeMappings.schemaId, schemaId))
      .all()
      .map(rowToMapping);
  }

  listAll(): FacetCodeMapping[] {
    return this.db
      .select()
      .from(facetCodeMappings)
      .orderBy(facetCodeMappings.facet)
      .all()
      .map(rowToMapping);
  }

  remove(facet: string): boolean {
    const result = this.db
      .delete(facetCodeMappings)
      .where(eq(facetCodeMappings.facet, facet))
      .run();
    return result.changes > 0;
  }
}

function rowToMapping(row: MappingRow): FacetCodeMapping {
  return {
    facet: row.facet,
    implementations: JSON.parse(row.implementations) as FacetCodeRef[],
    schemaId: row.schemaId ?? undefined,
  };
}

function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}
