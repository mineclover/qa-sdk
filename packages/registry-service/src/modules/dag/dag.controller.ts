// @def.boundary registry-system
// @def.doc registry-system

import { Controller, Get, Inject, Param, UseFilters } from "@nestjs/common";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { DagService } from "./dag.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller("dag")
export class DagController {
  constructor(@Inject(DagService) private readonly dag: DagService) {}

  @Get(":prefix/:versionId/deps")
  getDeps(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.dag.getDeps(prefix, versionId);
  }

  @Get(":prefix/:versionId/deps/transitive")
  getTransitiveDeps(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.dag.getTransitiveDeps(prefix, versionId);
  }

  @Get(":prefix/:versionId/reverse-refs")
  getReverseRefs(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.dag.getReverseRefs(prefix, versionId);
  }

  @Get("graph")
  getGraph() {
    return this.dag.getGraph();
  }
}
