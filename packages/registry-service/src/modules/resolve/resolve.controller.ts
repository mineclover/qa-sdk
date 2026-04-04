import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import { badRequest, noActiveVersion } from "../../lib/errors.js";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { ResolveService } from "./resolve.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller()
export class ResolveController {
  constructor(@Inject(ResolveService) private readonly resolveService: ResolveService) {}

  @Get("resolve/active")
  resolveAllActive() {
    return this.resolveService.resolveAllActive();
  }

  @Get("resolve/active/:prefix")
  async getActive(@Param("prefix") prefix: string) {
    const active = await this.resolveService.getActive(prefix);
    if (!active) {
      throw noActiveVersion(prefix);
    }
    return active;
  }

  @Get("resolve/manifest")
  resolveManifest() {
    return this.resolveService.resolveManifest();
  }

  @Get("resolve/services/:serviceId")
  resolveServiceRelease(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
    @Query("env") env?: string,
    @Query("region") region?: string,
    @Query("project") project?: string,
    @Query("stack") stack?: string,
    @Query("resourceKey") resourceKey?: string,
  ) {
    return this.resolveService.resolveServiceRelease(serviceId, {
      catalogId: catalogId ?? "demo",
      manifestVersion,
      env,
      region,
      project,
      stack,
      resourceKey,
    });
  }

  @Get("resolve/services/:serviceId/warnings")
  getServiceReleaseWarnings(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ) {
    return this.resolveService.getServiceReleaseWarnings(serviceId, {
      catalogId: catalogId ?? "demo",
      manifestVersion,
    });
  }

  @Get("resolve/services/:serviceId/cleanup-plan")
  getServiceCleanupPlan(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ) {
    return this.resolveService.getServiceCleanupPlan(serviceId, {
      catalogId: catalogId ?? "demo",
      manifestVersion,
    });
  }

  @Post("resolve/services/:serviceId/cleanup-draft")
  createCleanupDraft(
    @Param("serviceId") serviceId: string,
    @Body() body: {
      catalogId?: string;
      sourceManifestVersion?: string;
      newManifestVersion: string;
      replacements?: Partial<Record<"service-unit" | "ownership" | "exposure" | "runtime-address" | "deployment-binding", string>>;
      changelog?: string;
    },
  ) {
    return this.resolveService.createCleanupDraft(serviceId, body);
  }

  @Post("resolve/services/:serviceId/cleanup-activate")
  activateCleanupDraft(
    @Param("serviceId") serviceId: string,
    @Body() body: {
      catalogId?: string;
      manifestVersion: string;
    },
  ) {
    return this.resolveService.activateCleanupDraft(serviceId, body);
  }

  @Get("inspect/:prefix/:versionId/meta")
  inspectMeta(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.resolveService.inspectMeta(prefix, versionId);
  }

  @Get("inspect/:prefix/:versionId/keys")
  inspectKeys(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.resolveService.inspectKeys(prefix, versionId);
  }

  @Get("inspect/:prefix/:versionId/value/:address")
  inspectValue(
    @Param("prefix") prefix: string,
    @Param("versionId") versionId: string,
    @Param("address") address: string,
  ) {
    const parsedAddress = Number(address);
    if (!Number.isFinite(parsedAddress) || parsedAddress < 0) {
      throw badRequest(`유효하지 않은 주소: ${address}`);
    }
    return this.resolveService.inspectValue(prefix, versionId, parsedAddress);
  }
}
