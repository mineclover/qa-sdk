// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { BadRequestException, Controller, Get, Inject, Query, UseFilters } from '@nestjs/common';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';

import { DensityReadModelQuery } from '../../application/queries/density-read-model.query.js';
import type { MarginalDensityReadModel } from '../../domain/density.types.js';

/**
 * GET /density?catalog=sim&prefix=sim.bitmap&version=uv1
 * §5 §3.1 endpoint signature 정확 매칭.
 */
@Controller('density')
@UseFilters(DomainExceptionFilter)
export class DensityController {
  constructor(@Inject(DensityReadModelQuery) private readonly readModel: DensityReadModelQuery) {}

  @Get()
  async density(
    @Query('catalog') catalog: string,
    @Query('prefix') prefix: string,
    @Query('version') version: string,
  ): Promise<MarginalDensityReadModel> {
    if (!catalog || !prefix || !version) {
      throw new BadRequestException({
        error: 'missing_query_params',
        required: ['catalog', 'prefix', 'version'],
      });
    }
    return this.readModel.compute({ catalog, prefix, version });
  }
}
