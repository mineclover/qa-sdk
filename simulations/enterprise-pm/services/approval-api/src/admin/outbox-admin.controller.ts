// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.3 — outbox admin endpoint 표면.
// /admin/outbox/insert + /admin/outbox/dispatch — InternalIpGuard + zod body validation.
// 검증 실패 시 400 RFC 7807, 외부 IP 는 Guard 가 404 silent 처리.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import { OutboxAdminInsertService } from "./outbox-admin-insert.service.js";
import { OutboxAdminDispatchService } from "./outbox-admin-dispatch.service.js";
import { OutboxAdminStateQueryService } from "./outbox-admin-state-query.service.js";

const InsertBody = z.object({
  events: z.array(
    z.object({
      aggregateId: z.string().min(1),
      eventName: z.string().min(1),
      payload: z.unknown(),
      occurredAt: z.number().int().nonnegative(),
      eventVersion: z.number().int().positive().optional(),
    }),
  ),
});

const DispatchBody = z.object({
  replicaCount: z.number().int().min(1).max(16).optional(),
  timeoutMs: z.number().int().min(1).max(60_000).optional(),
  batchSize: z.number().int().min(1).max(1_000).optional(),
});

function validation(title: string, detail: string): HttpException {
  return new HttpException(
    {
      type: "https://qa-sdk.dev/errors/validation",
      title,
      status: 400,
      detail,
    },
    HttpStatus.BAD_REQUEST,
  );
}

@Controller("admin/outbox")
@UseGuards(InternalIpGuard)
export class OutboxAdminController {
  constructor(
    // Stage 1a Task 1.8 caveat — vitest 환경에서 reflect metadata 미해석을 회피하기 위해
    // class token 도 명시적으로 @Inject 한다.
    @Inject(OutboxAdminInsertService)
    private readonly insertSvc: OutboxAdminInsertService,
    @Inject(OutboxAdminDispatchService)
    private readonly dispatchSvc: OutboxAdminDispatchService,
    @Inject(OutboxAdminStateQueryService)
    private readonly stateSvc: OutboxAdminStateQueryService,
  ) {}

  @Post("insert")
  @HttpCode(HttpStatus.OK)
  async insert(@Body() raw: unknown) {
    const p = InsertBody.safeParse(raw);
    if (!p.success) {
      throw validation("Invalid /admin/outbox/insert body", p.error.message);
    }
    return this.insertSvc.insertEvents(p.data.events);
  }

  @Post("dispatch")
  @HttpCode(HttpStatus.OK)
  async dispatch(@Body() raw: unknown) {
    const p = DispatchBody.safeParse(raw);
    if (!p.success) {
      throw validation("Invalid /admin/outbox/dispatch body", p.error.message);
    }
    return this.dispatchSvc.dispatchAll(p.data);
  }

  /**
   * sim-handle outbox-client polling endpoint. ids CSV → 트리거 dispatch +
   * per-id (publishedAt, dispatcherId) 응답.
   *
   * 응답 shape (sim-handle 기대):
   *   { publishedAt: [[id, epochMs]...], dispatcherIds: [[id, scope_id]...] }
   *
   * scope_id 가 dispatcher 식별자로 사용 (sim 환경 dispatch worker 들은
   * scope_id 로 자기 claim 마킹). dispatcher worker 자동 가동되지 않는
   * 환경에서도 본 endpoint 호출 시 dispatchAll 트리거 후 state 조회 보장.
   */
  @Get("dispatch")
  async dispatchState(
    @Query("ids") idsCsv: string,
  ): Promise<{
    publishedAt: Array<[string, number]>;
    dispatcherIds: Array<[string, string]>;
  }> {
    if (typeof idsCsv !== "string" || idsCsv.length === 0) {
      throw validation(
        "Invalid /admin/outbox/dispatch query",
        "ids CSV query required",
      );
    }
    const ids = idsCsv
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length === 0) {
      return { publishedAt: [], dispatcherIds: [] };
    }
    // dispatcher 자동 가동 환경 — 이미 dispatched 면 no-op, 아니면 트리거.
    await this.dispatchSvc.dispatchAll({ replicaCount: 1, timeoutMs: 3_000 });
    return this.stateSvc.queryState(ids);
  }
}
