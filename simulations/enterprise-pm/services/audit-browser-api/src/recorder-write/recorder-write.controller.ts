// @def.boundary sim-audit-browser-api
// @def.doc server-side-admin-endpoints
//
// audit-recorder write endpoint (PR #2 follow-up). canary-controller `DecisionBuilderService.write`
// 가 `${SIM_AUDIT_RECORDER_URL}/v1/decisions` 로 POST. (cycleId, pass) 복합 키 멱등 — idempotency-key
// 헤더가 같으면 409 (이미 기록), 처음이면 200.
//
// 본 endpoint 는 sim 환경 e2e 시나리오 9~17 prerequisite — write 가 404 면 controller 가
// safety/resource decision 을 emit 못해 사이클 진행 차단. in-memory 멱등 map 으로 감음.

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';

interface DecisionEnvelope {
  decisionId?: unknown;
  cycleId?: unknown;
  pass?: unknown;
  cycleAt?: unknown;
  verdict?: unknown;
}

@Controller('v1')
export class RecorderWriteController {
  // (cycleId, pass) 복합 키 멱등 store. 같은 key 두 번째 호출 → 409.
  private readonly seen = new Map<string, { decisionId: string; receivedAt: string }>();

  @Post('decisions')
  @HttpCode(HttpStatus.OK)
  async writeDecision(
    @Body() body: DecisionEnvelope,
    @Headers('idempotency-key') idemKey?: string,
  ): Promise<{ ok: true; decisionId: string; receivedAt: string }> {
    if (typeof body !== 'object' || body === null) {
      throw new HttpException(
        { type: 'https://qa-sdk.dev/errors/validation', title: 'body must be object', status: 400 },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { decisionId, cycleId, pass } = body;
    if (typeof decisionId !== 'string' || typeof cycleId !== 'string') {
      throw new HttpException(
        {
          type: 'https://qa-sdk.dev/errors/validation',
          title: 'decisionId/cycleId required',
          status: 400,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (pass !== 'safety' && pass !== 'resource') {
      throw new HttpException(
        {
          type: 'https://qa-sdk.dev/errors/validation',
          title: "pass must be 'safety' or 'resource'",
          status: 400,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // idempotency-key 우선 (controller 헤더), 미설정 시 (cycleId, pass) 합성.
    const key = idemKey ?? `${cycleId}:${pass}`;
    const existing = this.seen.get(key);
    if (existing) {
      throw new HttpException(
        {
          type: 'https://qa-sdk.dev/errors/conflict',
          title: 'decision already recorded',
          status: 409,
          detail: `key=${key} prev decisionId=${existing.decisionId}`,
        },
        HttpStatus.CONFLICT,
      );
    }
    const receivedAt = new Date().toISOString();
    this.seen.set(key, { decisionId, receivedAt });
    return { ok: true, decisionId, receivedAt };
  }
}
