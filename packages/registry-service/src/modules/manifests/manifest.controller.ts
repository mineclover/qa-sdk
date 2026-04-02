import { Body, Controller, Get, Param, Post, UseFilters } from "@nestjs/common";
import type { PrefixLifecycleState, ManifestLifecycleState } from "pipe-store-sqlite";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { ManifestService } from "./manifest.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller("manifests")
export class ManifestController {
  constructor(private readonly manifests: ManifestService) {}

  // ── Prefix 라이프사이클 ──────────────────────────────
  // static "prefixes" segment 먼저 선언 → ":serviceId" 보다 우선 매칭

  @Post("prefixes")
  registerPrefix(@Body() body: { prefixId: string; version: string }) {
    return this.manifests.registerPrefix(body.prefixId, body.version);
  }

  @Get("prefixes/:prefixId/active")
  getActivePrefixVersion(@Param("prefixId") prefixId: string) {
    return this.manifests.getActivePrefixVersion(prefixId);
  }

  @Get("prefixes/:prefixId/:version")
  getPrefixRecord(
    @Param("prefixId") prefixId: string,
    @Param("version") version: string,
  ) {
    return this.manifests.getPrefixRecord(prefixId, version);
  }

  @Post("prefixes/:prefixId/:version/transition")
  transitionPrefix(
    @Param("prefixId") prefixId: string,
    @Param("version") version: string,
    @Body() body: { state: PrefixLifecycleState },
  ) {
    return this.manifests.transitionPrefix(prefixId, version, body.state);
  }

  // ── Service Manifest 라이프사이클 ────────────────────

  @Post()
  createManifest(
    @Body()
    body: {
      serviceId: string;
      manifestVersion: string;
      prefixes: Record<string, string>;
      changelog?: string;
    },
  ) {
    return this.manifests.createManifest(
      body.serviceId,
      body.manifestVersion,
      body.prefixes,
      body.changelog,
    );
  }

  @Get(":serviceId/active")
  getActiveManifest(@Param("serviceId") serviceId: string) {
    return this.manifests.getActiveManifest(serviceId);
  }

  @Get(":serviceId/:manifestVersion/transition")
  getManifestForTransition(
    @Param("serviceId") serviceId: string,
    @Param("manifestVersion") manifestVersion: string,
  ) {
    // GET으로 현재 상태 조회
    return this.manifests.getManifest(serviceId, manifestVersion);
  }

  @Get(":serviceId/:manifestVersion")
  getManifest(
    @Param("serviceId") serviceId: string,
    @Param("manifestVersion") manifestVersion: string,
  ) {
    return this.manifests.getManifest(serviceId, manifestVersion);
  }

  @Post(":serviceId/:manifestVersion/transition")
  transitionManifest(
    @Param("serviceId") serviceId: string,
    @Param("manifestVersion") manifestVersion: string,
    @Body() body: { state: ManifestLifecycleState },
  ) {
    return this.manifests.transitionManifest(serviceId, manifestVersion, body.state);
  }

  @Get(":serviceId")
  listManifests(@Param("serviceId") serviceId: string) {
    return this.manifests.listManifests(serviceId);
  }
}
