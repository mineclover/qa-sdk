// @def.boundary gate-system
// @def.doc gate-system

/**
 * Gate Service OpenAPI 계약 — 문서 전용.
 *
 * 실제 라우트는 gate.ts 한 곳에만 있다. 이 파일은 경로·요청·응답 스키마만 선언하고
 * 핸들러를 두지 않는다 (핸들러 사본이 실제 응답과 갈라졌던 문제, 06 M-5).
 * 선언과 실제 응답이 맞는지는 gate-openapi.test.ts가 served app으로 확인한다.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  gateLookupRequestSchema,
  gateRecomputeRequestSchema,
  gateFilterRangesRequestSchema,
} from '../schemas/gate.js';

// ── 응답 스키마 ──────────────────────────────────────

const addressStateEnum = z.enum(['active', 'inactive', 'open', 'reserved']);

const gateCheckResponseSchema = z
  .object({
    encode: z.boolean(),
    decode: z.boolean(),
    state: addressStateEnum,
    shouldVerify: z.boolean(),
  })
  .openapi('GateCheckResponse');

const gateClassifyResponseSchema = addressStateEnum.openapi('GateClassifyResponse');

const rangeSchema = z.tuple([z.number(), z.number()]);

/** index-meta AddressStateCacheRecord 그대로 — 상태가 계산된 적 없으면 null */
const gateStateResponseSchema = z
  .object({
    prefix: z.string(),
    versionId: z.string(),
    specs: z.array(z.unknown()),
    reservedRanges: z.array(rangeSchema),
    inactiveRanges: z.array(rangeSchema),
    openRanges: z.array(rangeSchema),
    computedAt: z.string(),
  })
  .nullable()
  .openapi('GateStateResponse');

/** gate 차단 범위를 뺀 [start, end] 목록 */
const gateFilterResponseSchema = z.array(rangeSchema).openapi('GateFilterResponse');

const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi('ErrorResponse');

// ── 라우트 정의 ──────────────────────────────────────

const checkRoute = createRoute({
  method: 'post',
  path: '/gate/check',
  tags: ['Gate'],
  summary: '주소 encode/decode 가능 여부 확인',
  description: '주소의 gate 상태를 확인하여 encode/decode 허용 여부를 반환한다.',
  request: { body: { content: { 'application/json': { schema: gateLookupRequestSchema } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: gateCheckResponseSchema } },
      description: 'Gate 확인 결과',
    },
    400: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: '잘못된 요청',
    },
  },
});

const classifyRoute = createRoute({
  method: 'post',
  path: '/gate/classify',
  tags: ['Gate'],
  summary: '주소 상태 분류',
  description: '주소의 상태를 active/inactive/open/reserved 중 하나로 분류한다.',
  request: { body: { content: { 'application/json': { schema: gateLookupRequestSchema } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: gateClassifyResponseSchema } },
      description: '분류 결과',
    },
  },
});

const recomputeRoute = createRoute({
  method: 'post',
  path: '/gate/recompute',
  tags: ['Gate'],
  summary: '단일 prefix 상태 재계산',
  description: 'DimStateSpec을 기반으로 단일 prefix의 주소 상태를 재계산한다.',
  request: { body: { content: { 'application/json': { schema: gateRecomputeRequestSchema } } } },
  responses: {
    204: { description: '재계산 완료' },
    501: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'GateEngine 미구성 (code: GATE_ENGINE_NOT_CONFIGURED)',
    },
  },
});

const cascadeRecomputeRoute = createRoute({
  method: 'post',
  path: '/gate/cascade-recompute',
  tags: ['Gate'],
  summary: 'leaf → composite cascade 전파',
  description: 'leaf prefix 변경을 composite prefix까지 DFS 전파하여 재계산한다.',
  request: { body: { content: { 'application/json': { schema: gateRecomputeRequestSchema } } } },
  responses: {
    204: { description: 'cascade 재계산 완료' },
    501: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'GateEngine 미구성 (code: GATE_ENGINE_NOT_CONFIGURED)',
    },
  },
});

const filterRangesRoute = createRoute({
  method: 'post',
  path: '/gate/filter-ranges',
  tags: ['Gate'],
  summary: 'gate 차단 범위 제거',
  description: '입력 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환한다.',
  request: { body: { content: { 'application/json': { schema: gateFilterRangesRequestSchema } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: gateFilterResponseSchema } },
      description: '필터링된 범위',
    },
  },
});

const getStateRoute = createRoute({
  method: 'get',
  path: '/gate/state/{prefix}/{version}',
  tags: ['Gate'],
  summary: 'prefix 전체 상태 범위 조회',
  description: 'prefix의 reserved/inactive/open 전체 범위를 반환한다.',
  request: {
    params: z.object({
      prefix: z.string().min(1),
      version: z.string().min(1),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: gateStateResponseSchema } },
      description: '상태 범위',
    },
  },
});

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              status: z.string(),
              gate_engine_configured: z.boolean(),
              uptime_seconds: z.number().optional(),
              version: z.string().optional(),
            })
            .openapi('HealthResponse'),
        },
      },
      description: '서비스 상태',
    },
  },
});

// ── 문서 생성 ────────────────────────────────────────

/** gate-service가 공개하는 라우트 계약 전체 */
export const GATE_OPENAPI_ROUTES = [
  checkRoute,
  classifyRoute,
  recomputeRoute,
  cascadeRecomputeRoute,
  filterRangesRoute,
  getStateRoute,
  healthRoute,
] as const;

export const GATE_OPENAPI_INFO = {
  title: 'Gate Service API',
  version: '1.0.0',
  description: '주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 서비스.',
} as const;

export function buildGateOpenAPIDocument(): ReturnType<OpenAPIHono['getOpenAPI31Document']> {
  const app = new OpenAPIHono();
  for (const route of GATE_OPENAPI_ROUTES) app.openAPIRegistry.registerPath(route);
  return app.getOpenAPI31Document({ openapi: '3.1.0', info: GATE_OPENAPI_INFO });
}
