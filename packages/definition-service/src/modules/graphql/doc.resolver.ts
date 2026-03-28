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
  Doc,
  IncomingLink,
  ImpactAnalysisResult,
  ConcernsResult,
  ValidationResultType,
} from "./doc.object.js";

@Resolver(() => Doc)
export class DocResolver {
  constructor(
    @Inject(DocsService) private readonly docsService: DocsService,
    @Inject(GraphService) private readonly graphService: GraphService,
  ) {}

  // ── Query ─────────────────────────────────────────────

  @Query(() => Doc, { nullable: true, description: "단일 문서 조회" })
  doc(@Args("id") id: string): Doc | null {
    const record = this.docsService.get(id);
    return record ? this.toDoc(record) : null;
  }

  @Query(() => [Doc], { description: "문서 목록 (확장 필터 + 전문검색 + pagination)" })
  docList(
    @Args("scope", { nullable: true }) scope?: string,
    @Args("aspect", { nullable: true }) aspect?: string,
    @Args("depth", { nullable: true }) depth?: string,
    @Args("lifecycle", { nullable: true }) lifecycle?: string,
    @Args("layer", { nullable: true }) layer?: string,
    @Args("svc", { nullable: true }) svc?: string,
    @Args("tag", { nullable: true }) tag?: string,
    @Args("address", { nullable: true }) address?: string,
    @Args("q", { nullable: true }) q?: string,
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
    @Args("offset", { type: () => Int, nullable: true }) offset?: number,
  ): Doc[] {
    const records = this.docsService.list({
      scope, aspect, depth, lifecycle, layer, svc, tag, address, q, limit, offset,
    });
    return records.map(r => this.toDoc(r));
  }

  @Query(() => ImpactAnalysisResult, { nullable: true, description: "영향 분석 (blast radius)" })
  impact(@Args("docId") docId: string): ImpactAnalysisResult | null {
    const result = this.graphService.impact(docId);
    if (!result) return null;
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
    };
  }

  @Query(() => ConcernsResult, { nullable: true, description: "concern 전파 조회" })
  concerns(@Args("docId") docId: string): ConcernsResult | null {
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

  // ── 헬퍼 ──────────────────────────────────────────────

  private toDoc(record: DocRecord): Doc {
    return {
      docId: record.docId,
      scope: record.scope,
      aspect: record.aspect,
      depth: record.depth,
      lifecycle: record.lifecycle,
      layer: record.layer,
      tags: record.tags,
      links: record.links,
      svc: record.svc,
      address: record.address,
      version: record.version,
      purpose: record.purpose,
      intent: record.intent,
      context: record.context,
      caveat: record.caveat,
      sourcePath: record.sourcePath,
    };
  }
}
