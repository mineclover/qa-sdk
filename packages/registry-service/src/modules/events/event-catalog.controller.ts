import { Controller, Get, Inject, Param, Query, UseFilters } from "@nestjs/common";
import { EventCatalogService } from "./event-catalog.service.js";
import { EventExceptionFilter } from "./event.exception-filter.js";

@UseFilters(new EventExceptionFilter())
@Controller("api/event-catalog")
export class EventCatalogController {
  constructor(@Inject(EventCatalogService) private readonly eventCatalog: EventCatalogService) {}

  @Get()
  summary() {
    return this.eventCatalog.summary();
  }

  @Get("events")
  listEvents(@Query("category") category?: string, @Query("channel") channel?: string) {
    return this.eventCatalog.listEvents({ category, channel });
  }

  @Get("events/:key")
  getEventDetails(@Param("key") key: string) {
    return this.eventCatalog.getEventDetails(key);
  }

  @Get("mappings")
  listMappings() {
    return this.eventCatalog.listMappings();
  }

  @Get("packs")
  listPacks() {
    return this.eventCatalog.listPacks();
  }

  @Get("packs/:packId")
  getPack(@Param("packId") packId: string) {
    return this.eventCatalog.getPack(packId);
  }

  @Get("categories")
  listCategories() {
    return this.eventCatalog.listCategories();
  }
}
