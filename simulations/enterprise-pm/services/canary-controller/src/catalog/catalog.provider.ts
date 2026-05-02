// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 + §7 — SimServiceCatalogPort 기본 구현 + DI provider.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.11
//
// 본 모듈은 controller 가 sim-service-catalog 을 wrap 한 async port 의 DI provider 를
// 제공한다. 카탈로그 SSOT 는 시뮬 환경에서 hardcode (서비스 이름 ↔ stable/candidate
// 정의) — 실제 운영에서는 catalog HTTP endpoint 에서 fetch 하지만 본 sub-project 범위는
// 시뮬 내부 관측이므로 in-memory wrapper 만 노출한다.

import {
  getCurrentTopology,
  type CatalogPrefixDefinition,
} from "sim-service-catalog";
import { type Provider } from "@nestjs/common";
import { type SimServiceCatalogPort } from "../action/action-executor.service.js";
import { SIM_SERVICE_CATALOG_TOKEN } from "./tokens.js";
import { SIM_SERVICE_CATALOG_TOKEN as ALERTS_TOKEN } from "../decision/alerts-audit-catalog.controller.js";

/**
 * 시뮬 카탈로그 SSOT — 서비스 별 stable/candidate refEntries.
 * 운영에서는 catalog HTTP endpoint, 시뮬에서는 컴파일 타임 상수.
 * approval 외 prefix 는 stable v1 만 노출 (시나리오 9~17 가 approval 만 사용).
 */
const SIM_CATALOG_FIXTURES: Record<string, CatalogPrefixDefinition> = {
  "sim.svc.approval": {
    prefix: "sim.svc.approval",
    versionAxis: { kind: "version", capacity: 16 },
    refEntries: [
      { version: "v1", state: "stable" },
      { version: "v2", state: "candidate" },
    ],
  },
};

/**
 * controller 가 사용하는 SimServiceCatalogPort 구현체.
 * - prefix 가 SIM_CATALOG_FIXTURES 에 없으면 throw — 미정의 prefix 호출은 wiring 버그.
 * - getCurrentTopology 는 sync 지만 port 는 async 이므로 await 가능한 Promise 반환.
 */
export class InMemorySimServiceCatalog implements SimServiceCatalogPort {
  async getCurrentTopology(prefix: string): ReturnType<
    SimServiceCatalogPort["getCurrentTopology"]
  > {
    const def = SIM_CATALOG_FIXTURES[prefix];
    if (!def) {
      throw new Error(
        `unknown catalog prefix: ${prefix} (allowed: ${Object.keys(SIM_CATALOG_FIXTURES).join(", ")})`,
      );
    }
    const topo = getCurrentTopology(def, { revision: 0 });
    return {
      stable: { value: topo.stable.value },
      candidate:
        topo.candidate === null ? null : { value: topo.candidate.value },
      retired: topo.retired.map((t) => ({ value: t.value })),
    };
  }
}

/** AppModule 이 inject 하는 provider — ActionExecutor 와 AlertsAuditCatalogController 가 동일 인스턴스 공유. */
export const simServiceCatalogProviders: Provider[] = [
  {
    provide: SIM_SERVICE_CATALOG_TOKEN,
    useFactory: () => new InMemorySimServiceCatalog(),
  },
  {
    // 같은 인스턴스를 다른 token 으로도 노출 (AlertsAuditCatalogController 가 사용).
    provide: ALERTS_TOKEN,
    useExisting: SIM_SERVICE_CATALOG_TOKEN,
  },
];
