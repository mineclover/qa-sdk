import { Body, Controller, Get, Inject, Param, Post, Put, Query, UseFilters } from "@nestjs/common";
import { ServiceExceptionFilter } from "./service.exception-filter.js";
import { ServiceComponentService } from "./service-component.service.js";

@UseFilters(new ServiceExceptionFilter())
@Controller("api/services")
export class ServiceComponentController {
  constructor(@Inject(ServiceComponentService) private readonly components: ServiceComponentService) {}

  @Get(":serviceId/components/:kind")
  listVersions(
    @Param("serviceId") serviceId: string,
    @Param("kind") kind: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.listVersions(catalogId ?? "demo", kind, serviceId);
  }

  @Get(":serviceId/components/:kind/published")
  listPublishedVersions(
    @Param("serviceId") serviceId: string,
    @Param("kind") kind: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.listPublishedVersions(catalogId ?? "demo", kind, serviceId);
  }

  @Get(":serviceId/assembly-candidates")
  getAssemblyCandidates(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.getAssemblyCandidates(catalogId ?? "demo", serviceId);
  }

  @Get(":serviceId/components/:kind/:version")
  get(
    @Param("serviceId") serviceId: string,
    @Param("kind") kind: string,
    @Param("version") version: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.get(catalogId ?? "demo", kind, serviceId, version);
  }

  @Put(":serviceId/components/:kind/:version")
  upsert(
    @Param("serviceId") serviceId: string,
    @Param("kind") kind: string,
    @Param("version") version: string,
    @Body() body: unknown,
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.upsert(catalogId ?? "demo", kind, serviceId, version, body);
  }

  @Post(":serviceId/components/:kind/:version/transition")
  transition(
    @Param("serviceId") serviceId: string,
    @Param("kind") kind: string,
    @Param("version") version: string,
    @Body() body: { state: "draft" | "published" | "deprecated" | "archived" },
    @Query("catalog") catalogId?: string,
  ) {
    return this.components.transition(catalogId ?? "demo", kind, serviceId, version, body.state);
  }
}
