import { Controller, Get, Post, Delete, Inject, Param, Query, Body, NotFoundException } from "@nestjs/common";
import { PrefixesService } from "./prefixes.service.js";

@Controller("prefixes")
export class PrefixesController {
  constructor(@Inject(PrefixesService) private readonly prefixes: PrefixesService) {}

  /** GET /prefixes — prefix 목록 (category 필터 가능) */
  @Get()
  list(@Query("category") category?: string) {
    const prefixes = this.prefixes.list(category ? { category } : undefined);
    return { prefixes, total: prefixes.length };
  }

  /** GET /prefixes/:prefixId — prefix 상세 */
  @Get(":prefixId")
  get(@Param("prefixId") prefixId: string) {
    const record = this.prefixes.get(prefixId);
    if (!record) throw new NotFoundException(`prefix ${prefixId} 없음`);
    return record;
  }

  /** GET /prefixes/:prefixId/deps — 의존 체인 (prefix_ref 재귀) */
  @Get(":prefixId/deps")
  deps(@Param("prefixId") prefixId: string) {
    const record = this.prefixes.get(prefixId);
    if (!record) throw new NotFoundException(`prefix ${prefixId} 없음`);
    const chain = this.prefixes.getDependencyChain(prefixId);
    return { prefixId, depChain: chain, depth: chain.length };
  }

  /** GET /prefixes/:prefixId/dependents — 이 prefix를 참조하는 prefix 목록 */
  @Get(":prefixId/dependents")
  dependents(@Param("prefixId") prefixId: string) {
    const record = this.prefixes.get(prefixId);
    if (!record) throw new NotFoundException(`prefix ${prefixId} 없음`);
    const deps = this.prefixes.getDependents(prefixId);
    return { prefixId, dependents: deps.map(d => d.prefixId), total: deps.length };
  }

  /** POST /prefixes — prefix 등록/갱신 */
  @Post()
  register(@Body() body: {
    prefixId: string;
    name: string;
    description?: string;
    category?: string;
    labels: string[];
    dims: Record<string, { kind: string; axisId?: string; prefixId?: string }>;
    versions: { version: string; axisVersions: Record<string, string> }[];
    meta?: Record<string, unknown>;
  }) {
    const depPrefixIds = Object.values(body.dims)
      .filter((d): d is { kind: "prefix_ref"; prefixId: string } => d.kind === "prefix_ref")
      .map(d => d.prefixId);

    const { action } = this.prefixes.upsert({
      prefixId: body.prefixId,
      name: body.name,
      description: body.description,
      category: body.category,
      labels: body.labels,
      dims: body.dims,
      versions: body.versions,
      meta: body.meta ?? {},
      depPrefixIds,
      version: 0,
      registeredAt: "",
      updatedAt: "",
    });

    return { prefixId: body.prefixId, action };
  }

  /** DELETE /prefixes/:prefixId — prefix 제거 */
  @Delete(":prefixId")
  remove(@Param("prefixId") prefixId: string) {
    const deleted = this.prefixes.remove(prefixId);
    if (!deleted) throw new NotFoundException(`prefix ${prefixId} 없음`);
    return { ok: true, prefixId };
  }
}
