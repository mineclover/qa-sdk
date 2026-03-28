import { Controller, Get, Inject, Param, Query, UseFilters } from "@nestjs/common";
import { DiagramService } from "./diagram.service.js";
import { DashboardExceptionFilter } from "./dashboard.exception-filter.js";

@UseFilters(new DashboardExceptionFilter())
@Controller("api/diagrams")
export class DiagramController {
  constructor(@Inject(DiagramService) private readonly diagrams: DiagramService) {}

  @Get()
  list() {
    return this.diagrams.list();
  }

  @Get(":kind/:id")
  get(
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Query("invariants") invariants?: string,
  ) {
    return this.diagrams.get(kind, id, invariants !== "false");
  }
}
