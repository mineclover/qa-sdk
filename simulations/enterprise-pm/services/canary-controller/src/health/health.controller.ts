// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Controller, Get } from '@nestjs/common';

const SERVICE_NAME = 'sim-canary-controller';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      ts: new Date().toISOString(),
    };
  }
}
