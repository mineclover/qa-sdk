/**
 * GraphQL Resolver — 문서 조회/탐색 (읽기 전용)
 *
 * mutation은 REST에서 처리. GraphQL은 쿼리 레이어만 담당.
 */

import { Args, Int, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { Inject } from "@nestjs/common";
import { DocsService } from "../docs/docs.service.js";
import { GraphService } from "../graph/graph.service.js";
import type { DocRecord } from "../../core/types.js";
import {
  BoundaryContextResultType,
  BoundaryResultType,
  Doc,
  FeedbackRequestSummary,
  IncomingLink,
  ImpactAnalysisResult,
  ConcernsResult,
  SyntheticIncomingLink,
  ValidationResultType,
} from "./doc.object.js";

function toGraphQlGate(record: DocRecord["gate"]) {
  if (!record) return undefined;
  return {
    ...record,
    references: record.references ? [...record.references] : undefined,
    suggestOnPass: record.suggestOnPass ? [...record.suggestOnPass] : undefined,
    suggestOnFail: record.suggestOnFail ? [...record.suggestOnFail] : undefined,
  };
}

@Resolver(() => Doc)
export class DocResolver {
  constructor(
    @Inject(DocsService) private readonly docsService: DocsService,
    @Inject(GraphService) private readonly graphService: GraphService,
  ) {}

  // ── Query ─────────────────────────────────────────────

  @Query(() => Doc, { nullable: true, description: "단일 문서 조회" })
  doc(@Args("id", { type: () => String }) id: string): Doc | null {
    const record = this.docsService.get(id);
    return record ? this.toDoc(record) : null;
  }

  @Query(() => [Doc], { description: "문서 목록 (확장 필터 + 전문검색 + pagination)" })
  docList(
    @Args("level", { type: () => String, nullable: true }) level?: string,
    @Args("scope", { type: () => String, nullable: true }) scope?: string,
    @Args("aspect", { type: () => String, nullable: true }) aspect?: string,
    @Args("depth", { type: () => String, nullable: true }) depth?: string,
    @Args("lifecycle", { type: () => String, nullable: true }) lifecycle?: string,
    @Args("layer", { type: () => String, nullable: true }) layer?: string,
    @Args("svc", { type: () => String, nullable: true }) svc?: string,
    @Args("tag", { type: () => String, nullable: true }) tag?: string,
    @Args("address", { type: () => String, nullable: true }) address?: string,
    @Args("q", { type: () => String, nullable: true }) q?: string,
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
    @Args("offset", { type: () => Int, nullable: true }) offset?: number,
  ): Doc[] {
    const records = this.docsService.list({
      level, scope, aspect, depth, lifecycle, layer, svc, tag, address, q, limit, offset,
    });
    return records.map(r => this.toDoc(r));
  }

  @Query(() => ImpactAnalysisResult, { nullable: true, description: "영향 분석 (blast radius)" })
  impact(@Args("docId", { type: () => String }) docId: string): ImpactAnalysisResult | null {
    const result = this.graphService.impact(docId);
    if (!result) return null;
    const feedbackTrace = this.docsService.getFeedbackTrace([
      docId,
      ...result.impacted.map((item) => item.id),
    ]);
    return {
      sourceId: result.sourceId,
      impacted: result.impacted.map(d => ({
        docId: d.id,
        scope: d.via,
        layer: d.layer,
        path: d.path.join(" → "),
        distance: d.depth,
      })),
      blastRadius: result.blastRadius,
      feedbackTrace,
    };
  }

  @Query(() => ConcernsResult, { nullable: true, description: "concern 전파 조회" })
  concerns(@Args("docId", { type: () => String }) docId: string): ConcernsResult | null {
    const result = this.graphService.concerns(docId);
    if (!result) return null;
    return {
      docId: result.docId,
      direct: [...result.concerns.direct],
      inherited: result.concerns.inherited.map(i => ({
        tag: i.concern,
        source: i.from,
      })),
      all: [...result.concerns.all],
    };
  }

  @Query(() => ValidationResultType, { description: "그래프 검증" })
  validateGraph(): ValidationResultType {
    return this.graphService.validate();
  }

  @Query(() => BoundaryResultType, { nullable: true, description: "바운더리 구조 + direct coupling 조회" })
  boundary(
    @Args("docId", { type: () => String }) docId: string,
    @Args("level", { type: () => String, nullable: true }) level?: string,
  ): BoundaryResultType | null {
    const result = this.docsService.getBoundary(
      docId,
      level === "purpose" ? "purpose" : "overview",
    );
    return result;
  }

  @Query(() => BoundaryContextResultType, { nullable: true, description: "바운더리 구조 + concerns + impact + feedback trace 조회" })
  boundaryContext(
    @Args("docId", { type: () => String }) docId: string,
    @Args("level", { type: () => String, nullable: true }) level?: string,
    @Args("mode", { type: () => String, nullable: true }) mode?: string,
  ): BoundaryContextResultType | null {
    return this.graphService.boundaryContext(
      docId,
      level === "purpose" ? "purpose" : "overview",
      mode === "direct" ? "direct" : "transitive",
    );
  }

  // ── ResolveField (관계 필드 lazy 로딩) ────────────────

  @ResolveField(() => [Doc], { description: "contains 자식 문서" })
  children(@Parent() doc: Doc): Doc[] {
    return this.docsService.getChildren(doc.docId).map(r => this.toDoc(r));
  }

  @ResolveField(() => Doc, { nullable: true, description: "contains 부모 문서" })
  parent(@Parent() doc: Doc): Doc | null {
    const record = this.docsService.getParent(doc.docId);
    return record ? this.toDoc(record) : null;
  }

  @ResolveField(() => [IncomingLink], { description: "역링크" })
  incomingLinks(@Parent() doc: Doc): IncomingLink[] {
    return this.docsService.getIncomingLinks(doc.docId);
  }

  @ResolveField(() => [SyntheticIncomingLink], { description: "synthetic 역링크 (feedback_request)" })
  syntheticIncomingLinks(@Parent() doc: Doc): SyntheticIncomingLink[] {
    return this.docsService.getSyntheticIncomingLinks(doc.docId);
  }

  @ResolveField(() => [FeedbackRequestSummary], { description: "이 문서와 연결된 feedback request 요약" })
  feedbackRequests(@Parent() doc: Doc): FeedbackRequestSummary[] {
    return this.docsService.getFeedbackRequests(doc.docId);
  }

  @ResolveField("boundary", () => BoundaryResultType, { nullable: true, description: "이 문서의 바운더리 구조 + direct coupling" })
  resolveBoundary(@Parent() doc: Doc): BoundaryResultType | null {
    return this.docsService.getBoundary(doc.docId, "overview");
  }

  @ResolveField("boundaryContext", () => BoundaryContextResultType, { nullable: true, description: "이 문서의 바운더리 컨텍스트" })
  resolveBoundaryContext(@Parent() doc: Doc): BoundaryContextResultType | null {
    return this.graphService.boundaryContext(doc.docId, "overview", "transitive");
  }

  // ── 헬퍼 ──────────────────────────────────────────────

  private toDoc(record: DocRecord): Doc {
    return {
      docId: record.docId,
      title: record.title,
      level: record.level,
      scope: record.scope,
      aspect: record.aspect,
      depth: record.depth,
      lifecycle: record.lifecycle,
      layer: record.layer,
      tags: record.tags,
      links: record.links,
      svc: record.svc,
      docVersion: record.docVersion,
      revision: record.revision,
      address: record.address,
      version: record.version,
      purpose: record.purpose,
      intent: record.intent,
      context: record.context,
      caveat: record.caveat,
      gate: toGraphQlGate(record.gate),
      sourcePath: record.sourcePath,
    };
  }
}
