// @def.boundary gate-system
// @def.doc gate-system

/**
 * Gate Service OpenAPI 라우트.
 *
 * 기존 gate.ts의 기능을 @hono/zod-openapi로 래핑하여
 * OpenAPI 3.1 스펙을 자동 생성한다.
 *
 * 기존 gate.ts는 유지 — 이 파일은 OpenAPI 스펙 생성 + 라우트 등록 겸용.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { GateLookupService } from '../lib/gate-service.js';
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

const gateStateResponseSchema = z
  .object({
    reserved: z.array(z.tuple([z.number(), z.number()])),
    inactive: z.array(z.tuple([z.number(), z.number()])),
    open: z.array(z.tuple([z.number(), z.number()])),
  })
  .nullable()
  .openapi('GateStateResponse');

const gateFilterResponseSchema = z
  .object({
    ranges: z.array(z.tuple([z.number(), z.number()])),
  })
  .openapi('GateFilterResponse');

const errorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
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
            })
            .openapi('HealthResponse'),
        },
      },
      description: '서비스 상태',
    },
  },
});

// ── 앱 생성 ──────────────────────────────────────────

export interface GateOpenAPIDeps {
  gateService: GateLookupService;
  engineConfigured: boolean;
}

export function createGateOpenAPIApp(deps: GateOpenAPIDeps) {
  const app = new OpenAPIHono();

  app.openapi(checkRoute, async (c) => {
    const req = c.req.valid('json');
    const result = await deps.gateService.checkGate(req.prefix, req.versionId, req.address);
    return c.json(result, 200);
  });

  app.openapi(classifyRoute, async (c) => {
    const req = c.req.valid('json');
    const state = await deps.gateService.classifyAddress(req.prefix, req.versionId, req.address);
    return c.json(state, 200);
  });

  app.openapi(recomputeRoute, async (c) => {
    const req = c.req.valid('json');
    await deps.gateService.recompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.openapi(cascadeRecomputeRoute, async (c) => {
    const req = c.req.valid('json');
    await deps.gateService.cascadeRecompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.openapi(filterRangesRoute, async (c) => {
    const req = c.req.valid('json');
    const ranges = await deps.gateService.filterRanges(
      req.prefix,
      req.versionId,
      req.ranges,
      req.mode,
    );
    return c.json({ ranges }, 200);
  });

  app.openapi(getStateRoute, async (c) => {
    const { prefix, version } = c.req.valid('param');
    const record = await deps.gateService.getStateRanges(prefix, version);
    // AddressStateCacheRecord → 간소화된 응답 변환
    if (!record) return c.json(null, 200);
    return c.json(
      {
        reserved: record.reservedRanges as unknown as [number, number][],
        inactive: record.inactiveRanges as unknown as [number, number][],
        open: record.openRanges as unknown as [number, number][],
      },
      200,
    );
  });

  app.openapi(healthRoute, async (c) => {
    return c.json({ status: 'ok', gate_engine_configured: deps.engineConfigured }, 200);
  });

  // OpenAPI JSON 엔드포인트
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Gate Service API',
      version: '1.0.0',
      description:
        '주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 서비스.',
    },
  });

  return app;
}
