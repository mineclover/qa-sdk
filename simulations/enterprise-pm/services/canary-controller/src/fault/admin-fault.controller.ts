// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 runner가 호출하는 단일 HTTP 표면 — POST /admin/fault/:kind body {enabled, params?, target?}.
// spec 05 §3.2 helper (injectLag, burstLoad, dropInvalidate) 는 모두 본 라우트로 라우팅된다.
// spec 2026-05-02 §6 — 응답 shape `{ kind, active, params?, target? }`.
// spec 2026-05-02 §11 — 검증 실패 → 400 RFC 7807 (validation), 미등록 kind → 400 (zod enum).
// controller 본 사이클은 fault 상태를 읽지 않고 단계 9 metrics scrape 경로가 자연스레
// 측정한다. controller 라이프사이클 종료 시 OnModuleDestroy 에서 resetAll() 로 상태 누수 방지.
//
// 외부 인증 없음 (network isolation 의존) — admin-router 는 시뮬 내부 표면 전용.

import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { FaultInjector } from "./fault-injector.js";
import { FAULT_KINDS, type FaultKind } from "./types.js";

const KindSchema = z.enum(FAULT_KINDS);

// spec §6 body schema — 6 kind discriminated union. params 의 강한 검증은 fault 클래스
// (PubsubInvalidateDropFault.enable, PerfWarnFault.enable) 가 추가 throw 로 수행하므로
// 본 controller 는 공통 (enabled, params?, target?) 만 검증.
const BodySchema = z.object({
  enabled: z.boolean(),
  params: z.record(z.unknown()).optional(),
  target: z.unknown().optional(),
});

export const FAULT_INJECTOR_TOKEN = Symbol("FAULT_INJECTOR");

const ERR_VALIDATION = "https://qa-sdk.dev/errors/validation";
const ERR_STORE_FAILURE = "https://qa-sdk.dev/errors/store-failure";

@Controller("admin/fault")
export class AdminFaultController {
  /**
   * spec §6 응답 shape `active` 도출용 — admin endpoint 가 enable/disable 후 자체적으로
   * 추적 (기존 4 Fault 클래스가 isEnabled 를 노출하지 않는 backward compat 이슈 대응).
   * 신규 2 클래스는 isEnabled() 를 노출하지만, 응답 일관성을 위해 본 sideMap 을 SSOT 로 한다.
   */
  private readonly active = new Map<
    FaultKind,
    { params: unknown; target: unknown }
  >();

  constructor(
    @Inject(FAULT_INJECTOR_TOKEN) private readonly injector: FaultInjector,
  ) {}

  @Post(":kind")
  async toggle(
    @Param("kind") kindRaw: string,
    @Body() bodyRaw: unknown,
  ): Promise<{
    kind: FaultKind;
    active: boolean;
    params?: unknown;
    target?: unknown;
  }> {
    const kindParsed = KindSchema.safeParse(kindRaw);
    if (!kindParsed.success) {
      throw new BadRequestException({
        type: ERR_VALIDATION,
        title: "unknown fault kind",
        status: 400,
        detail: `kind=${kindRaw} (allowed: ${FAULT_KINDS.join(", ")})`,
      });
    }
    const bodyParsed = BodySchema.safeParse(bodyRaw);
    if (!bodyParsed.success) {
      throw new BadRequestException({
        type: ERR_VALIDATION,
        title: "fault body invalid",
        status: 400,
        detail: bodyParsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }
    const kind = kindParsed.data;
    const { enabled, params, target } = bodyParsed.data;

    if (enabled) {
      try {
        await this.injector.enable(kind, params ?? {});
      } catch (err) {
        // params 단계 검증 실패 (e.g. dropRate range, severity literal) → 400 RFC 7807.
        // FaultInjector.enable 은 단순 위임이라 throw 는 fault 클래스 측의 zod/throw.
        throw new BadRequestException({
          type: ERR_VALIDATION,
          title: "fault params invalid",
          status: 400,
          detail: (err as Error).message,
        });
      }
      this.active.set(kind, { params: params ?? {}, target });
    } else {
      try {
        await this.injector.disable(kind, target);
      } catch (err) {
        throw new InternalServerErrorException({
          type: ERR_STORE_FAILURE,
          title: "fault disable failed",
          status: 500,
          detail: (err as Error).message,
        });
      }
      this.active.delete(kind);
    }

    const state = this.active.get(kind);
    const response: {
      kind: FaultKind;
      active: boolean;
      params?: unknown;
      target?: unknown;
    } = {
      kind,
      active: state !== undefined,
    };
    if (state !== undefined) {
      if (state.params !== undefined) response.params = state.params;
      if (state.target !== undefined) response.target = state.target;
    }
    return response;
  }
}
