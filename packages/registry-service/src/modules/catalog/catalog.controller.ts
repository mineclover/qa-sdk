// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { CatalogExceptionFilter } from './catalog.exception-filter.js';
import { CatalogService } from './catalog.service.js';

@UseFilters(new CatalogExceptionFilter())
@Controller('catalogs')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogs: CatalogService) {}

  @Post()
  register(@Body() body: unknown) {
    return this.catalogs.register(body);
  }

  @Get()
  list() {
    return this.catalogs.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalogs.get(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.catalogs.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogs.remove(id);
  }

  @Get(':id/prefixes')
  listPrefixes(@Param('id') id: string) {
    return this.catalogs.listPrefixes(id);
  }

  @Get(':id/config')
  getConfig(@Param('id') id: string) {
    return this.catalogs.getConfig(id);
  }

  @Put(':id/config')
  setConfig(@Param('id') id: string, @Body() body: unknown) {
    return this.catalogs.setConfig(id, body);
  }

  @Get(':id/pattern-rules')
  getPatternRules(@Param('id') id: string) {
    return this.catalogs.getPatternRules(id);
  }

  @Put(':id/pattern-rules')
  setPatternRules(@Param('id') id: string, @Body() body: unknown) {
    return this.catalogs.setPatternRules(id, body);
  }

  @Get(':id/configs')
  listConfigs(@Param('id') id: string) {
    return this.catalogs.listConfigs(id);
  }
}
