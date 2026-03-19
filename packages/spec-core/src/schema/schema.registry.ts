import type { SchemaDef, SchemaFragment, SchemaCategory, SchemaAxis } from "./schema.types.js";
import { DuplicateRegistrationError, NotFoundError } from "../shared/errors.js";

/**
 * 스키마 + fragment를 등록하고 조회하는 레지스트리.
 *
 * fragment의 resolve(합성)도 이 레지스트리가 담당한다.
 * 순수 TypeScript — NestJS 의존 없음.
 */
export class SchemaRegistry {
  private readonly schemas = new Map<string, SchemaDef>();
  private readonly fragments = new Map<string, SchemaFragment>();

  // ── Schema ────────────────────────────────────────

  registerSchema(schema: SchemaDef): void {
    if (this.schemas.has(schema.id)) {
      throw new DuplicateRegistrationError("Schema", schema.id);
    }
    this.schemas.set(schema.id, schema);
  }

  getSchema(schemaId: string): SchemaDef {
    const schema = this.schemas.get(schemaId);
    if (!schema) throw new NotFoundError("Schema", schemaId);
    return schema;
  }

  hasSchema(schemaId: string): boolean {
    return this.schemas.has(schemaId);
  }

  /** category별 스키마 목록 */
  getByCategory(category: SchemaCategory): SchemaDef[] {
    return [...this.schemas.values()].filter(s => s.category === category);
  }

  /** 등록된 모든 스키마 ID */
  schemaKeys(): IterableIterator<string> {
    return this.schemas.keys();
  }

  get schemaCount(): number {
    return this.schemas.size;
  }

  // ── Fragment ──────────────────────────────────────

  registerFragment(fragment: SchemaFragment): void {
    if (this.fragments.has(fragment.id)) {
      throw new DuplicateRegistrationError("Fragment", fragment.id);
    }
    this.fragments.set(fragment.id, fragment);
  }

  getFragment(fragmentId: string): SchemaFragment {
    const fragment = this.fragments.get(fragmentId);
    if (!fragment) throw new NotFoundError("Fragment", fragmentId);
    return fragment;
  }

  hasFragment(fragmentId: string): boolean {
    return this.fragments.has(fragmentId);
  }

  /** 등록된 모든 fragment ID */
  fragmentKeys(): IterableIterator<string> {
    return this.fragments.keys();
  }

  get fragmentCount(): number {
    return this.fragments.size;
  }

  // ── Resolve ───────────────────────────────────────

  /**
   * 스키마의 use 필드에 선언된 fragment를 resolve하여
   * 완전한 axes를 가진 SchemaDef를 반환한다.
   *
   * fragment axes → schema axes 순서로 합성.
   * 동일 axisId가 있으면 schema 쪽이 우선 (override).
   */
  resolveSchema(schemaId: string): SchemaDef {
    const schema = this.getSchema(schemaId);
    if (!schema.use || schema.use.length === 0) return schema;

    const mergedAxes: Record<string, SchemaAxis> = {};

    // fragment axes 먼저 (선언 순서대로)
    for (const fragmentId of schema.use) {
      const fragment = this.getFragment(fragmentId);
      for (const [key, axis] of Object.entries(fragment.axes)) {
        mergedAxes[key] = axis;
      }
    }

    // schema 자체 axes가 override
    for (const [key, axis] of Object.entries(schema.axes)) {
      mergedAxes[key] = axis;
    }

    return { ...schema, axes: mergedAxes, use: undefined };
  }
}
