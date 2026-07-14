// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'decision-service' };
  }
}
