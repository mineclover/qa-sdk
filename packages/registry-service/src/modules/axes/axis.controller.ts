// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
} from "@nestjs/common";
import { AxisExceptionFilter } from "./axis.exception-filter.js";
import { AxisService } from "./axis.service.js";

@UseFilters(new AxisExceptionFilter())
@Controller("catalogs/:catalogId/axes")
export class AxisController {
  constructor(@Inject(AxisService) private readonly axes: AxisService) {}

  @Get()
  list(@Param("catalogId") catalogId: string) {
    return this.axes.list(catalogId);
  }

  @Get(":id")
  get(@Param("catalogId") catalogId: string, @Param("id") id: string) {
    return this.axes.get(catalogId, id);
  }

  @Post()
  register(@Param("catalogId") catalogId: string, @Body() body: unknown) {
    return this.axes.register(catalogId, body);
  }

  @Patch(":id")
  patch(
    @Param("catalogId") catalogId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.axes.patch(catalogId, id, body);
  }

  @HttpCode(200)
  @Post(":id/entries")
  addEntry(
    @Param("catalogId") catalogId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.axes.addEntry(catalogId, id, body);
  }

  @Delete(":id")
  remove(@Param("catalogId") catalogId: string, @Param("id") id: string) {
    return this.axes.remove(catalogId, id);
  }
}
