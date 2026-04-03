import type { SpecDocument, SpecId, SpecRelation, SpecLifecycle } from "./spec.types.js";
import { DuplicateRegistrationError, NotFoundError } from "spec-schema";

/**
 * 스펙 문서를 등록하고 관계를 탐색하는 레지스트리.
 *
 * 순수 TypeScript — NestJS 의존 없음.
 */
export class SpecDocumentRegistry {
  private readonly docs = new Map<SpecId, SpecDocument>();

  register(doc: SpecDocument): void {
    if (this.docs.has(doc.id)) {
      throw new DuplicateRegistrationError("SpecDocument", doc.id);
    }
    this.docs.set(doc.id, doc);
  }

  get(id: SpecId): SpecDocument {
    const doc = this.docs.get(id);
    if (!doc) throw new NotFoundError("SpecDocument", id);
    return doc;
  }

  has(id: SpecId): boolean {
    return this.docs.has(id);
  }

  /** 특정 spec에서 출발하는 모든 관계 */
  relationsFrom(id: SpecId): readonly SpecRelation[] {
    const doc = this.get(id);
    return (doc.relations ?? []).filter(r => r.from === id);
  }

  /** 특정 spec을 참조하는 모든 관계 (전체 문서 탐색) */
  relationsTo(id: SpecId): readonly SpecRelation[] {
    const result: SpecRelation[] = [];
    for (const doc of this.docs.values()) {
      if (!doc.relations) continue;
      for (const rel of doc.relations) {
        if (rel.to === id) result.push(rel);
      }
    }
    return result;
  }

  /** lifecycle 기준 필터 */
  getByLifecycle(lifecycle: SpecLifecycle): SpecDocument[] {
    return [...this.docs.values()].filter(d => d.lifecycle === lifecycle);
  }

  /** 등록된 모든 spec ID */
  keys(): IterableIterator<SpecId> {
    return this.docs.keys();
  }

  get size(): number {
    return this.docs.size;
  }
}
