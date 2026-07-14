// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

const SERVICE_NAME = 'sim-pm-api';
const OWNED_PREFIXES = ['sim.project', 'sim.task', 'sim.member'] as const;

@Controller()
export class HealthController {
  @Get('health')
  health() {
    const tracer = trace.getTracer(SERVICE_NAME);
    const otelStatus = tracer.constructor.name === 'NoopTracer' ? 'noop' : 'ok';
    return {
      status: 'ok',
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      otelStatus,

      ts: new Date().toISOString(),
    };
  }
}
