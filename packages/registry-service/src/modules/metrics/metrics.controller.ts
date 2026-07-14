// @def.boundary registry-system
// @def.doc registry-system

import { Controller, Get, Header, Inject } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Controller()
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  @Get('metrics')
  async render() {
    return this.metrics.render();
  }
}
