import { Injectable, Inject } from "@nestjs/common";
import {
  analyzeImpact,
  computeEffectiveConcerns,
  docRowToRegistryInput,
  formatCodeReferenceTarget,
  makeCodeReferenceScopeKey,
  MemoryDefinitionRegistry,
  selectConcernContext,
  selectImpactContext,
  validateGraph,
  type DefBoundaryContextResult,
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

  private resolveBoundaryAnchor(doc: DocRecord): DocRecord {
    if (doc.level === "group" || doc.level === "module") return doc;

    let current = doc;
    const visited = new Set<string>([doc.docId]);
    while (true) {
      const parent = this.docs.getParent(current.docId);
      if (!parent || visited.has(parent.docId)) return current;
      if (parent.level === "group" || parent.level === "module") return parent;
      visited.add(parent.docId);
      current = parent;
    }
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

  impactByAddress(address: string): ImpactAnalysis | null {
    const doc = this.docs.getByAddress(address);
    if (!doc) return null;
    return this.impact(doc.docId);
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

  boundaryContext(
    docId: string,
    level: "purpose" | "overview" = "overview",
    mode: "direct" | "transitive" = "transitive",
  ): DefBoundaryContextResult | null {
    if (!this.docs.get(docId)) return null;

    const boundary = this.docs.getBoundary(docId, level);
    if (!boundary) return null;

    const concerns = this.concerns(docId);
    const impact = this.impact(docId);
    if (!concerns || !impact) return null;

    const selectedConcerns = selectConcernContext(concerns.concerns, mode);
    const selectedImpact = selectImpactContext(impact, mode);
    const feedbackTrace = this.docs.getFeedbackTrace([
      docId,
      ...selectedImpact.impacted.map((item) => item.id),
    ]);

    return {
      mode,
      level,
      boundary,
      concerns: {
        docId,
        direct: [...selectedConcerns.direct],
        inherited: selectedConcerns.inherited.map((item) => ({
          tag: item.concern,
          source: item.from,
          via: item.via,
        })),
        all: [...selectedConcerns.all],
      },
      impact: {
        sourceId: selectedImpact.sourceId,
        ...(selectedImpact.sourceAddress ? { sourceAddress: selectedImpact.sourceAddress } : {}),
        impacted: selectedImpact.impacted.map((item) => ({
          docId: item.id,
          ...(item.address ? { address: item.address } : {}),
          via: item.via,
          path: item.path.join(" → "),
          direction: item.direction,
          distance: item.depth,
          ...(item.layer ? { layer: item.layer } : {}),
          crossLayer: item.crossLayer,
        })),
        affectedGroups: [...selectedImpact.affectedGroups],
        blastRadius: selectedImpact.blastRadius,
        byLayer: selectedImpact.byLayer,
      },
      feedbackTrace,
    };
  }

  boundaryContextByAddress(
    address: string,
    level: "purpose" | "overview" = "overview",
    mode: "direct" | "transitive" = "transitive",
  ): DefBoundaryContextResult | null {
    const doc = this.docs.getByAddress(address);
    if (!doc) return null;
    return this.boundaryContext(doc.docId, level, mode);
  }

  /** 그래프 검증 — 깨진 링크, 순환 참조, 고아 문서 (DB 기반) */
  validate(): { issues: ValidationIssue[]; errors: number; warnings: number; passed: boolean } {
    const allDocs = this.docs.list();
    const allIds = new Set(allDocs.map(d => d.docId));
    const issues: ValidationIssue[] = [];
    const registry = new MemoryDefinitionRegistry();

    for (const doc of allDocs) {
      registry.register(docRowToRegistryInput(doc));
    }

    for (const doc of allDocs) {
      const outgoing = this.docs.getOutgoingLinks(doc.docId);
      for (const link of outgoing) {
        if (!allIds.has(link.target)) {
          issues.push({
            severity: "error",
            type: "broken-link",
            docId: doc.docId,
            message: `target "${link.target}" (${link.type})가 존재하지 않음`,
          });
          continue;
        }
        registry.link(doc.docId, link.target, link.type as DefinitionLink["linkType"]);
      }
    }

    issues.push(...validateGraph(registry).issues);

    const docsById = new Map(allDocs.map((doc) => [doc.docId, doc]));
    const refsByPath = new Map<string, ReturnType<DocsService["listCodeReferences"]>>();
    for (const ref of this.docs.listCodeReferences()) {
      const doc = docsById.get(ref.docId);
      if (!doc) {
        issues.push({
          severity: "error",
          type: "broken-code-reference",
          docId: ref.docId,
          message: `code reference "${ref.codePath}"가 존재하지 않는 문서 "${ref.docId}"를 참조`,
        });
        continue;
      }
      if (ref.relationType === "boundary" && doc.level !== "group" && doc.level !== "module") {
        issues.push({
          severity: "error",
          type: "invalid-code-boundary",
          docId: ref.docId,
          message: `boundary reference "${ref.codePath}"는 group/module 문서를 가리켜야 함`,
        });
      }
      const scopeKey = makeCodeReferenceScopeKey(ref.codePath, ref.symbol);
      const bucket = refsByPath.get(scopeKey) ?? [];
      bucket.push(ref);
      refsByPath.set(scopeKey, bucket);
    }

    for (const [_scopeKey, pathRefs] of refsByPath) {
      const targetLabel = formatCodeReferenceTarget({
        codePath: pathRefs[0]!.codePath,
        symbol: pathRefs[0]!.symbol,
      });
      const boundaryIds = [...new Set(
        pathRefs
          .filter((ref) => ref.relationType === "boundary" && docsById.has(ref.docId))
          .map((ref) => ref.docId),
      )];

      if (boundaryIds.length > 1) {
        issues.push({
          severity: "error",
          type: "ambiguous-code-boundary",
          docId: boundaryIds[0]!,
          message: `code reference "${targetLabel}"에 둘 이상의 boundary가 선언됨: ${boundaryIds.join(", ")}`,
        });
        continue;
      }

      const explicitBoundaryId = boundaryIds[0] ?? null;
      const inferredAnchorIds = new Set<string>();
      for (const ref of pathRefs) {
        const doc = docsById.get(ref.docId);
        if (!doc) continue;
        const anchor = this.resolveBoundaryAnchor(doc);
        inferredAnchorIds.add(anchor.docId);
        if (explicitBoundaryId && anchor.docId !== explicitBoundaryId) {
          issues.push({
            severity: "error",
            type: "inconsistent-code-boundary",
            docId: ref.docId,
            message: `code reference "${targetLabel}"의 explicit boundary "${explicitBoundaryId}"와 문서 "${ref.docId}"의 anchor "${anchor.docId}"가 다름`,
          });
        }
      }

      if (!explicitBoundaryId && inferredAnchorIds.size > 1) {
        issues.push({
          severity: "error",
          type: "ambiguous-code-boundary",
          docId: pathRefs[0]!.docId,
          message: `code reference "${targetLabel}"가 여러 boundary anchor에 걸침: ${[...inferredAnchorIds].join(", ")}`,
        });
      }
    }

    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }
}
