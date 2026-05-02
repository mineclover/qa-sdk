// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseFilters,
} from "@nestjs/common";
import { ServiceExceptionFilter } from "./service.exception-filter.js";
import { ApplicationService } from "./application.service.js";

@UseFilters(new ServiceExceptionFilter())
@Controller("api/applications")
export class ApplicationController {
  constructor(@Inject(ApplicationService) private readonly applications: ApplicationService) {}

  @Get()
  list(@Query("catalog") catalogId?: string) {
    return this.applications.list(catalogId ?? "demo");
  }

  @Get(":applicationId")
  get(@Param("applicationId") applicationId: string, @Query("catalog") catalogId?: string) {
    return this.applications.get(catalogId ?? "demo", applicationId);
  }

  @Put()
  replace(@Body() body: unknown, @Query("catalog") catalogId?: string) {
    return this.applications.replaceAll(catalogId ?? "demo", body);
  }
}
