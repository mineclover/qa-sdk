// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import {
  createDraftSchema,
  listVersionsQuerySchema,
  patchDraftSchema,
} from "../../schemas/version.js";
import type { ExtendedVersionStatus } from "../../types/index.js";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { VersionService } from "./version.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller("prefixes/:prefix/versions")
export class VersionController {
  constructor(@Inject(VersionService) private readonly versions: VersionService) {}

  @Post()
  createDraft(@Param("prefix") prefix: string, @Body() body: unknown) {
    return this.versions.createDraft(prefix, createDraftSchema.parse(body));
  }

  @Get()
  listVersions(@Param("prefix") prefix: string, @Query() query: unknown) {
    const parsed = listVersionsQuerySchema.parse(query);
    return this.versions.listVersions(prefix, parsed.status as ExtendedVersionStatus | undefined);
  }

  @Get(":versionId")
  getVersion(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.versions.getVersion(prefix, versionId);
  }

  @Patch(":versionId")
  patchDraft(
    @Param("prefix") prefix: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    return this.versions.patchDraft(prefix, versionId, patchDraftSchema.parse(body));
  }

  @HttpCode(200)
  @Post(":versionId/lock")
  async lockDraft(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    await this.versions.lockDraft(prefix, versionId);
    return { ok: true };
  }

  @HttpCode(200)
  @Post(":versionId/unlock")
  async unlockDraft(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    await this.versions.unlockDraft(prefix, versionId);
    return { ok: true };
  }

  @HttpCode(200)
  @Post(":versionId/release")
  async release(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    await this.versions.release(prefix, versionId);
    return { ok: true };
  }

  @HttpCode(200)
  @Post(":versionId/activate")
  activate(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.versions.activate(prefix, versionId);
  }

  @HttpCode(200)
  @Post(":versionId/deprecate")
  async deprecate(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    await this.versions.deprecate(prefix, versionId);
    return { ok: true };
  }
}
