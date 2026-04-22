// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { AuditExplorerService } from "./audit-explorer.service.js";

/**
 * GET /audit/trace/:rootSpanId       — nested tree
 * GET /audit/firstFailure/:rootSpanId — 첫 deny/error entry
 * GET /audit/entry/:spanId            — 단일 entry
 */
@Controller("audit")
export class AuditExplorerController {
  constructor(
    @Inject(AuditExplorerService) private readonly svc: AuditExplorerService,
  ) {}

  @Get("trace/:rootSpanId")
  async trace(@Param("rootSpanId") id: string) {
    const entries = await this.svc.listTrace(id);
    return { rootSpanId: id, count: entries.length, entries };
  }

  @Get("firstFailure/:rootSpanId")
  async firstFailure(@Param("rootSpanId") id: string) {
    const entry = await this.svc.findFirstFailure(id);
    return { rootSpanId: id, firstFailure: entry };
  }

  @Get("entry/:spanId")
  async entry(@Param("spanId") id: string) {
    const e = await this.svc.getEntry(id);
    if (!e) throw new NotFoundException({ error: "not_found", spanId: id });
    return e;
  }
}
