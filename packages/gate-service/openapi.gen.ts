/**
 * OpenAPI JSON 생성 스크립트.
 *
 * 실행: npx tsx openapi.gen.ts > openapi.json
 */
import { createGateOpenAPIApp } from './src/routes/gate-openapi.js';
import type { GateLookupService } from './src/lib/gate-service.js';

const stubService: GateLookupService = {
  engine: null,
  checkGate: async () => ({
    encode: true,
    decode: true,
    state: 'active' as const,
    shouldVerify: false,
  }),
  classifyAddress: async () => 'active' as const,
  recompute: async () => {},
  cascadeRecompute: async () => {},
  filterRanges: async () => [],
  getStateRanges: async () => null,
};

const app = createGateOpenAPIApp({ gateService: stubService, engineConfigured: false });
const spec = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: {
    title: 'Gate Service API',
    version: '1.0.0',
    description: '주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 서비스.',
  },
});

console.log(JSON.stringify(spec, null, 2));
