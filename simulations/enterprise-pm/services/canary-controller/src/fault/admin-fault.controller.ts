// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 runner가 호출하는 단일 HTTP 표면 — POST /admin/fault/:kind body {enabled, params?}
// spec 05 §3.2 helper(injectLag, burstLoad, dropInvalidate)는 모두 본 라우트로 라우팅된다.
// controller 본 사이클은 fault 상태를 읽지 않고 단계 9 metrics scrape 경로가 자연스레
// 측정한다. controller 라이프사이클 종료 시 OnModuleDestroy에서 resetAll()로 상태 누수 방지.
//
// 외부 인증 없음(network isolation 의존) — admin-router는 시뮬 내부 표면 전용.

import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { FaultInjector } from "./fault-injector.js";
import type { FaultKind } from "./types.js";

const KINDS = [
  "schema-break",
  "audit-anomaly",
  "replication-lag",
  "db-pool-pressure",
] as const satisfies readonly FaultKind[];

const KindSchema = z.enum(KINDS);

const BodySchema = z.object({
  enabled: z.boolean(),
  params: z.record(z.unknown()).optional(),
  // disable 대상 세분화 (db-pool-pressure 등). admin-router는 enabled=false일 때 위임.
  target: z.unknown().optional(),
});

export const FAULT_INJECTOR_TOKEN = Symbol("FAULT_INJECTOR");

@Controller("admin/fault")
export class AdminFaultController {
  constructor(
    @Inject(FAULT_INJECTOR_TOKEN) private readonly injector: FaultInjector,
  ) {}

  @Post(":kind")
  async toggle(@Param("kind") kindRaw: string, @Body() bodyRaw: unknown) {
    const kindParsed = KindSchema.safeParse(kindRaw);
    if (!kindParsed.success) {
      throw new BadRequestException({ error: `unknown fault kind: ${kindRaw}` });
    }
    const bodyParsed = BodySchema.safeParse(bodyRaw);
    if (!bodyParsed.success) {
      throw new BadRequestException({ error: bodyParsed.error.format() });
    }
    const kind = kindParsed.data;
    const { enabled, params, target } = bodyParsed.data;
    if (enabled) {
      await this.injector.enable(kind, params ?? {});
    } else {
      await this.injector.disable(kind, target);
    }
    return { ok: true, kind, enabled };
  }
}
