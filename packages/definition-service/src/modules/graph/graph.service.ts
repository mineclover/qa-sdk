import { Injectable, Inject } from "@nestjs/common";
import {
  analyzeImpact,
  computeEffectiveConcerns,
  type ImpactAnalysis,
  type EffectiveConcerns,
  type DefinitionEntry,
  type DefinitionLink,
  type ValidationIssue,
} from "definition-catalog";
import { DocsService } from "../docs/docs.service.js";
import type { DocRecord } from "../../core/types.js";

/** DocRecord → DefinitionEntry 변환 (콜백 호환) */
function toEntry(doc: DocRecord): DefinitionEntry {
  return {
    id: doc.docId,
    title: doc.docId,
    scope: doc.scope as DefinitionEntry["scope"],
    aspect: doc.aspect as DefinitionEntry["aspect"],
    depth: doc.depth as DefinitionEntry["depth"],
    lifecycle: doc.lifecycle as DefinitionEntry["lifecycle"],
    layer: doc.layer as DefinitionEntry["layer"],
    tags: doc.tags,
    serviceId: doc.svc,
    address: 0,
    serialized: doc.address ?? "",
    createdAt: doc.syncedAt,
    updatedAt: doc.syncedAt,
  };
}

@Injectable()
export class GraphService {
  constructor(@Inject(DocsService) private readonly docs: DocsService) {}

  /** DB에서 DefinitionEntry 조회 */
  private getEntry(id: string): DefinitionEntry | undefined {
    const doc = this.docs.get(id);
    return doc ? toEntry(doc) : undefined;
  }

  /** DB edge 테이블에서 링크 조회 */
  private getLinks(id: string, direction: "outgoing" | "incoming"): readonly DefinitionLink[] {
    if (direction === "outgoing") {
      return this.docs.getOutgoingLinks(id).map(l => ({
        sourceId: id,
        targetId: l.target,
        linkType: l.type as DefinitionLink["linkType"],
        address: 0,
        serialized: "",
      }));
    }
    return this.docs.getIncomingLinks(id).map(l => ({
      sourceId: l.source,
      targetId: id,
      linkType: l.type as DefinitionLink["linkType"],
      address: 0,
      serialized: "",
    }));
  }

  /** 영향 분석 — DB edge 테이블 기반 */
  impact(docId: string): ImpactAnalysis | null {
    if (!this.docs.get(docId)) return null;
    return analyzeImpact(
      docId,
      (id) => this.getEntry(id),
      (id, dir) => this.getLinks(id, dir),
    );
  }

  /** concern 전파 — DB edge 테이블 기반 */
  concerns(docId: string): { docId: string; concerns: EffectiveConcerns } | null {
    if (!this.docs.get(docId)) return null;
    const concerns = computeEffectiveConcerns(
      docId,
      (id) => this.getEntry(id),
      (id, dir) => this.getLinks(id, dir),
    );
    return { docId, concerns };
  }

  /** 그래프 검증 — 깨진 링크, 순환 참조, 고아 문서 (DB 기반) */
  validate(): { issues: ValidationIssue[]; errors: number; warnings: number; passed: boolean } {
    const allDocs = this.docs.list();
    const allIds = new Set(allDocs.map(d => d.docId));
    const referenced = new Set<string>();
    const issues: ValidationIssue[] = [];

    for (const doc of allDocs) {
      if (doc.lifecycle === "deprecated") continue;
      const outgoing = this.docs.getOutgoingLinks(doc.docId);
      for (const link of outgoing) {
        referenced.add(link.target);
        if (!allIds.has(link.target)) {
          issues.push({ severity: "error", type: "broken-link", docId: doc.docId, message: `target "${link.target}" (${link.type})가 존재하지 않음` });
        }
        if (link.target === doc.docId) {
          issues.push({ severity: "error", type: "self-ref", docId: doc.docId, message: `자기 자신을 ${link.type}로 참조` });
        }
      }
      const incoming = this.docs.getIncomingLinks(doc.docId);
      if (incoming.length > 0) referenced.add(doc.docId);
    }

    // 순환 참조
    const cyclicTypes = new Set(["depends_on", "implements", "refines"]);
    for (const doc of allDocs) {
      if (doc.lifecycle === "deprecated") continue;
      const visited = new Set<string>();
      const stack = [doc.docId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) {
          if (current === doc.docId) {
            issues.push({ severity: "error", type: "circular-ref", docId: doc.docId, message: "순환 참조 감지" });
          }
          continue;
        }
        visited.add(current);
        for (const l of this.docs.getOutgoingLinks(current)) {
          if (cyclicTypes.has(l.type) && allIds.has(l.target)) stack.push(l.target);
        }
      }
    }

    // 고아 문서
    for (const doc of allDocs) {
      if (doc.lifecycle !== "approved") continue;
      if (!referenced.has(doc.docId)) {
        const hasContains = this.docs.getOutgoingLinks(doc.docId).some(l => l.type === "contains");
        if (!hasContains) {
          issues.push({ severity: "warning", type: "orphan", docId: doc.docId, message: "approved 리프이지만 어디에도 참조되지 않음" });
        }
      }
    }

    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }
}
