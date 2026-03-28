import { Controller, Get, Inject, Param, Query, UseFilters } from "@nestjs/common";
import { CatalogExceptionFilter } from "./catalog.exception-filter.js";
import { DecodeMapService } from "./decode-map.service.js";

@UseFilters(new CatalogExceptionFilter())
@Controller("api/decode-map")
export class DecodeMapController {
  constructor(@Inject(DecodeMapService) private readonly decodeMaps: DecodeMapService) {}

  @Get()
  list(@Query("catalog") catalogId?: string) {
    return this.decodeMaps.list(catalogId ?? "demo");
  }

  @Get(":prefix/:version")
  get(
    @Param("prefix") prefix: string,
    @Param("version") version: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.decodeMaps.get(catalogId ?? "demo", prefix, version);
  }
}
