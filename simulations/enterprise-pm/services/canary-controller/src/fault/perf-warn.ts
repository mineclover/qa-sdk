// @def.boundary sim-canary-controller
// spec 2026-05-02 §8 — perf-warn fault (시나리오 17).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.3
//
// 효과: perf 카테고리에 인위적 WARN 신호 주입 → Pass 1 hold (rollback 아님) → Pass 2 SKIP.
// 시나리오 17 에서 RPS 폭증 + perf-warn 동시 발생 → Pass 1 hold → Pass 2 SKIP 검증.
//
// 본 클래스는 기존 Fault 인터페이스 (async enable/disable/reset) 그대로 구현하며,
// 추가로 동기 accessor (isEnabled/getParams/getTarget) 와 verdict wrap 함수 (applyTo) 를
// 노출. CategoryVerdictService 와 같은 인스턴스를 inject 받아 perf 결과를 wrap.
//
// severity 확장 여지: 현재 spec §8 은 "warn" 만 정의. 향후 "fail" 추가 가능성은 ParamsSchema
// 확장으로 열려 있지만 현재는 enum literal "warn" 만 허용.

import { Injectable } from "@nestjs/common";
import type { Fault } from "./types.js";
import type { Verdict } from "../verdict/category-verdict.service.js";

export interface PerfWarnParams {
  severity: "warn";
}

@Injectable()
export class PerfWarnFault implements Fault {
  readonly kind = "perf-warn" as const;
  private params: PerfWarnParams | null = null;
  private target: string | undefined;

  async enable(rawParams: unknown, target?: unknown): Promise<void> {
    // 현재 spec §8 은 severity="warn" 만 허용 (확장 여지는 향후 reserved).
    const obj = (rawParams ?? {}) as { severity?: unknown };
    if (obj.severity !== "warn") {
      throw new Error(
        `severity must be "warn" (spec §8), got ${JSON.stringify(obj.severity)}`,
      );
    }
    this.params = { severity: "warn" };
    this.target = typeof target === "string" ? target : undefined;
  }

  async disable(): Promise<void> {
    this.params = null;
    this.target = undefined;
  }

  async reset(): Promise<void> {
    await this.disable();
  }

  isEnabled(): boolean {
    return this.params !== null;
  }

  getParams(): PerfWarnParams | null {
    return this.params ? { ...this.params } : null;
  }

  getTarget(): string | undefined {
    return this.target;
  }

  /**
   * VerdictService 가 호출: enabled 시 perf=PASS → WARN 격상.
   * - disabled → passthrough
   * - PASS → WARN (격상)
   * - WARN → WARN (그대로)
   * - FAIL → FAIL (격하 금지, 더 강한 신호 보존)
   */
  applyTo(perfVerdict: Verdict): Verdict {
    if (this.params === null) return perfVerdict;
    if (perfVerdict === "FAIL") return "FAIL";
    return "WARN";
  }
}
