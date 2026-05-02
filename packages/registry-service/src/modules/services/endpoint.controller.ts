// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseFilters,
} from "@nestjs/common";
import { ServiceExceptionFilter } from "./service.exception-filter.js";
import { EndpointService } from "./endpoint.service.js";

@UseFilters(new ServiceExceptionFilter())
@Controller("api/endpoints")
export class EndpointController {
  constructor(@Inject(EndpointService) private readonly endpoints: EndpointService) {}

  @Get()
  list(@Query("catalog") catalogId?: string) {
    return this.endpoints.list(catalogId ?? "demo");
  }

  @Get("resolve")
  resolve(
    @Query("catalog") catalogId?: string,
    @Query("namespace") namespace?: string,
    @Query("name") name?: string,
    @Query("env") env?: string,
    @Query("region") region?: string,
  ) {
    return this.endpoints.resolve(catalogId ?? "demo", namespace, name, env, region);
  }

  @Get(":ns/:svc")
  listByService(
    @Param("ns") namespace: string,
    @Param("svc") serviceName: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.endpoints.listByService(catalogId ?? "demo", namespace, serviceName);
  }

  @Get(":ns/:svc/:env/:region")
  get(
    @Param("ns") namespace: string,
    @Param("svc") serviceName: string,
    @Param("env") env: string,
    @Param("region") region: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.endpoints.get(catalogId ?? "demo", namespace, serviceName, env, region);
  }

  @Put(":ns/:svc/:env/:region")
  upsert(
    @Param("ns") namespace: string,
    @Param("svc") serviceName: string,
    @Param("env") env: string,
    @Param("region") region: string,
    @Body() body: unknown,
    @Query("catalog") catalogId?: string,
  ) {
    return this.endpoints.upsert(catalogId ?? "demo", namespace, serviceName, env, region, body);
  }

  @Delete(":ns/:svc/:env/:region")
  remove(
    @Param("ns") namespace: string,
    @Param("svc") serviceName: string,
    @Param("env") env: string,
    @Param("region") region: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.endpoints.remove(catalogId ?? "demo", namespace, serviceName, env, region);
  }
}
