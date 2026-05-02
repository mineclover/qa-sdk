// @def.boundary registry-system
// @def.doc registry-system

import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseFilters } from "@nestjs/common";
import type { PrefixProfilePatch } from "../../stores/prefix-owner-store.js";
import { badRequest } from "../../lib/errors.js";
import { registerPrefixSchema } from "../../schemas/prefix.js";
import { PrefixExceptionFilter } from "./prefix.exception-filter.js";
import { PrefixService } from "./prefix.service.js";

interface PatchPrefixBody {
  name?: string;
  category?: string;
  meta?: Record<string, unknown>;
  labels?: string[];
}

const VALID_CATEGORIES = ["entity", "event", "relation", "state", "policy", "observation"] as const;

@UseFilters(new PrefixExceptionFilter())
@Controller("prefixes")
export class PrefixController {
  constructor(@Inject(PrefixService) private readonly prefixes: PrefixService) {}

  @Post()
  register(@Body() body: unknown) {
    return this.prefixes.register(registerPrefixSchema.parse(body));
  }

  @Get()
  list() {
    return this.prefixes.list();
  }

  @Get(":prefix")
  async get(@Param("prefix") prefix: string) {
    const record = await this.prefixes.get(prefix);
    const versions = await this.prefixes.listVersions(prefix);
    return { ...record, versions };
  }

  @Patch(":prefix")
  async patch(@Param("prefix") prefix: string, @Body() body: PatchPrefixBody) {
    const patch: PrefixProfilePatch = {};
    if (body.name) patch.name = body.name;
    if (body.labels) patch.labels = body.labels;
    if (body.category || body.meta) {
      patch.meta = {
        ...(body.category ? { category: body.category } : {}),
        ...body.meta,
      };
    }

    if (body.category && !VALID_CATEGORIES.includes(body.category as (typeof VALID_CATEGORIES)[number])) {
      throw badRequest(`'${body.category}'는 유효한 카테고리가 아닙니다. 유효값: ${VALID_CATEGORIES.join(", ")}`);
    }

    const updated = await this.prefixes.patch(prefix, patch);
    return updated;
  }

  @Delete(":prefix")
  async remove(@Param("prefix") prefix: string) {
    await this.prefixes.remove(prefix);
    return { ok: true };
  }
}
