// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 1~3 + InternalIpGuard (§3).
//
// 외부 IP 접근 시 InternalIpGuard 가 자동 404. zod query 검증 실패 → RFC 7807 400.
// pass별 verdict enum 분기 검증. ring buffer 조회 후 sim-decision-view 변환을 거쳐 응답.

import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import {
  toSafetyDecisionView,
  toResourceDecisionView,
  type SafetyDecisionRecordView,
  type ResourceDecisionRecordView,
} from "sim-decision-view";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";

const Pass = z.enum(["safety", "resource"]);
const SafetyVerdict = z.enum(["promote", "hold", "rollback"]);
const ResourceVerdict = z.enum(["scale-up", "scale-down", "hold", "rejected"]);

const Q_DECISIONS = z.object({
  pass: Pass,
  verdict: z.string().optional(),
  since: z.string().optional(),
  cycleIds: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const Q_FIRST = z.object({
  pass: Pass,
  verdict: z.string().optional(),
  cycleIds: z.string().optional(),
});
const Q_RECENT = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const ERR_TYPE = "https://qa-sdk.dev/errors/validation";
const bad = (detail: string): never => {
  throw new BadRequestException({
    type: ERR_TYPE,
    title: "validation failed",
    status: 400,
    detail,
  });
};
function parse<T>(schema: z.ZodSchema<T>, raw: Record<string, unknown>): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    bad(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return r.data as T;
}
function checkVerdict(
  pass: "safety" | "resource",
  verdict: string | undefined,
): void {
  if (verdict === undefined) return;
  const sc = pass === "safety" ? SafetyVerdict : ResourceVerdict;
  if (!sc.safeParse(verdict).success) {
    bad(`verdict invalid for pass=${pass}: ${verdict}`);
  }
}
const splitCsv = (s: string | undefined): string[] | undefined =>
  s === undefined || s.length === 0
    ? undefined
    : s
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

type DecisionView = SafetyDecisionRecordView | ResourceDecisionRecordView;
type DecisionRecord = Parameters<typeof toSafetyDecisionView>[0] | Parameters<typeof toResourceDecisionView>[0];
const toView = (r: DecisionRecord): DecisionView =>
  r.pass === "safety" ? toSafetyDecisionView(r) : toResourceDecisionView(r);

@Controller("v1")
@UseGuards(InternalIpGuard)
export class DecisionQueryController {
  // vitest 환경은 emitDecoratorMetadata 를 무시하므로 @Inject 토큰을 명시한다.
  constructor(
    @Inject(DecisionRingBuffer) private readonly ringBuffer: DecisionRingBuffer,
  ) {}

  @Get("decisions")
  decisions(@Query() raw: Record<string, unknown>): { items: DecisionView[] } {
    const q = parse(Q_DECISIONS, raw);
    checkVerdict(q.pass, q.verdict);
    const records = this.ringBuffer.queryDecisions({
      pass: q.pass,
      verdict: q.verdict,
      since: q.since,
      cycleIds: splitCsv(q.cycleIds),
      limit: q.limit,
    });
    return { items: records.map((r) => toView(r)) };
  }

  @Get("decisions/first")
  decisionsFirst(
    @Query() raw: Record<string, unknown>,
  ): { item: DecisionView | null } {
    const q = parse(Q_FIRST, raw);
    checkVerdict(q.pass, q.verdict);
    const r = this.ringBuffer.queryFirst({
      pass: q.pass,
      verdict: q.verdict,
      cycleIds: splitCsv(q.cycleIds),
    });
    return { item: r === null ? null : toView(r) };
  }

  @Get("cycles/recent")
  cyclesRecent(
    @Query() raw: Record<string, unknown>,
  ): { cycleIds: string[]; total: number } {
    const q = parse(Q_RECENT, raw);
    // zod default 보장 — limit 은 항상 number.
    return {
      cycleIds: this.ringBuffer.recentCycleIds(q.limit ?? 10),
      total: this.ringBuffer.recentCycleCount(),
    };
  }
}
