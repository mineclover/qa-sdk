/**
 * OpenAPI JSON 생성 스크립트.
 *
 * 실행: corepack pnpm exec tsx openapi.gen.ts > openapi.json
 */
import { buildGateOpenAPIDocument } from './src/routes/gate-openapi.js';

console.log(JSON.stringify(buildGateOpenAPIDocument(), null, 2));
