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
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ServiceExceptionFilter } from './service.exception-filter.js';
import { ServiceTopologyService } from './service-topology.service.js';

@UseFilters(new ServiceExceptionFilter())
@Controller('api/services')
export class ServiceController {
  constructor(@Inject(ServiceTopologyService) private readonly services: ServiceTopologyService) {}

  @Get()
  list(@Query('catalog') catalogId?: string) {
    return this.services.list(catalogId ?? 'demo');
  }

  @Get('svc-owners')
  listSvcOwners(@Query('catalog') catalogId?: string) {
    return this.services.listSvcOwners(catalogId ?? 'demo');
  }

  @Get('urls')
  listUrls(
    @Query('catalog') catalogId?: string,
    @Query('env') envName?: string,
    @Query('namespace') namespace?: string,
    @Query('region') region?: string,
  ) {
    return this.services.listUrls(catalogId ?? 'demo', {
      envName: envName ?? 'dev',
      namespace: namespace ?? 'shop',
      region: region ?? 'asia',
    });
  }

  @Get('gateway')
  getGateway(
    @Query('catalog') catalogId?: string,
    @Query('env') envName?: string,
    @Query('namespace') namespace?: string,
    @Query('region') region?: string,
  ) {
    return this.services.getGateway(catalogId ?? 'demo', {
      envName: envName ?? 'dev',
      namespace: namespace ?? 'shop',
      region: region ?? 'asia',
    });
  }

  @Get(':serviceId')
  get(@Param('serviceId') serviceId: string, @Query('catalog') catalogId?: string) {
    return this.services.get(catalogId ?? 'demo', serviceId);
  }

  @HttpCode(200)
  @Post()
  upsert(@Body() body: unknown, @Query('catalog') catalogId?: string) {
    return this.services.upsert(catalogId ?? 'demo', body);
  }

  @Patch()
  replace(@Body() body: unknown, @Query('catalog') catalogId?: string) {
    return this.services.replaceAll(catalogId ?? 'demo', body);
  }

  @Put()
  replaceWithPut(@Body() body: unknown, @Query('catalog') catalogId?: string) {
    return this.services.replaceAll(catalogId ?? 'demo', body);
  }

  @Delete(':serviceId')
  remove(@Param('serviceId') serviceId: string, @Query('catalog') catalogId?: string) {
    return this.services.remove(catalogId ?? 'demo', serviceId);
  }
}
