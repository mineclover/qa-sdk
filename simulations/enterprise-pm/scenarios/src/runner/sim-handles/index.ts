// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// wireSimHandles — Plan E Stage 11 follow-up #24 (a)/(d) + 시나리오 1~8 HTTP 보강.
//
// 12개 globalThis handle (시나리오 9~17) + __simHandle/__simGatewayFetch (시나리오 1~8)
// 을 binding 한다. e2e 부팅 시 sim-up + 본 함수 호출 후 SIM_SCENARIO_INPROC=1 로
// 시나리오 PASS 검증.
//
// 각 handle은 HTTP fetch 기반(env-driven URL). 단위 테스트는 fetchImpl 주입으로
// 격리한다.

import { createAuditFetcher } from "./audit-fetcher.js";
import { createWaitForCycles } from "./wait-for-cycles.js";
import { createCatalogStore } from "./catalog-store.js";
import { createFaultInjector } from "./fault-injector.js";
import {
  createComposeHandle,
  type ExecLike,
} from "./compose-handle.js";
import { createBurstLoad } from "./burst-load.js";
import { createBffRead } from "./bff-read.js";
import { createOutboxClient } from "./outbox-client.js";
import { createBitmapMetrics } from "./bitmap-metrics.js";
import { createBitmapVersionMutator } from "./bitmap-version-mutator.js";
import { createBitmapVersionCheck } from "./bitmap-version-check.js";
import { createGatewayStickyConsistency } from "./gateway-sticky-consistency.js";
import {
  createSimGatewayFetch,
  createSimHandle,
  type SimHandle,
} from "./sim-handle.js";

export interface SimHandlesUrls {
  /** audit-recorder query API base URL. 시나리오 9~17 audit-fetcher/wait-for-cycles. */
  auditRecorderUrl: string;
  /** canary-controller admin/cycle base URL. 시나리오 9, 10, 12, 13, fault-injector. */
  controllerUrl: string;
  /** gateway admin base URL. 시나리오 9 sticky consistency, burst-load 대상. */
  gatewayUrl: string;
  /** auth-api admin base URL. 시나리오 16 bitmap metrics + version mutator + check. */
  authApiUrl: string;
  /** approval-api admin base URL. 시나리오 15 outbox client. */
  approvalApiUrl: string;
  /** BFF read endpoint URL. 시나리오 14. */
  bffReadUrl: string;
  /** burst-load 대상 URL. 시나리오 12, 13, 17. 기본 gatewayUrl + "/healthz". */
  burstLoadTargetUrl?: string;
}

export interface SimHandlesOptions {
  /** docker compose service 이름 override. */
  composeServiceNames?: { v1: string; v2: string };
  /** docker compose CLI exec 주입 (테스트용). */
  composeExecImpl?: ExecLike;
  /** 외부 호출 공통 timeout (기본 5_000ms). */
  timeoutMs?: number;
}

export interface WireSimHandlesArgs extends SimHandlesUrls, SimHandlesOptions {}

const HANDLE_KEYS = [
  "__simAuditFetcher",
  "__simWaitForCycles",
  "__simCatalogStore",
  "__simFaultInjector",
  "__simComposeHandle",
  "__simBurstLoad",
  "__simBffRead",
  "__simOutboxClient",
  "__simBitmapMetrics",
  "__simBitmapVersionMutator",
  "__simBitmapVersionCheck",
  "__simGatewayStickyConsistency",
  // 시나리오 1~8 — HTTP 모드 진입점.
  "__simHandle",
  "__simGatewayFetch",
] as const;

type HandleKey = (typeof HANDLE_KEYS)[number];

/**
 * wireSimHandles — 14 globalThis handle binding.
 *
 *   - 1~12: 시나리오 9~17 (canary/audit/bitmap-cache 인프라 handle).
 *   - 13: __simHandle      → 시나리오 1~8 fixture + seedBudgetRequest + delegateProject + authApp shim
 *   - 14: __simGatewayFetch → 시나리오 1~8 의 `new Request("http://sim/...")` 흐름을 외부 gateway URL 로 변환
 *
 * 멱등 보장: 같은 옵션으로 두 번 호출하면 두 번 다 binding이 갱신된다.
 * unwireSimHandles로 모든 handle 제거.
 */
export function wireSimHandles(args: WireSimHandlesArgs): void {
  const t = args.timeoutMs;
  const burstUrl =
    args.burstLoadTargetUrl ?? `${args.gatewayUrl.replace(/\/$/, "")}/healthz`;

  const simHandle: SimHandle = createSimHandle({
    gatewayUrl: args.gatewayUrl,
    authApiUrl: args.authApiUrl,
    timeoutMs: t,
  });

  const handles = {
    __simAuditFetcher: createAuditFetcher({
      controllerUrl: args.controllerUrl,
      timeoutMs: t,
    }),
    __simWaitForCycles: createWaitForCycles({
      controllerUrl: args.controllerUrl,
      requestTimeoutMs: t,
    }),
    __simCatalogStore: createCatalogStore({
      controllerUrl: args.controllerUrl,
      timeoutMs: t,
    }),
    __simFaultInjector: createFaultInjector({
      controllerUrl: args.controllerUrl,
      timeoutMs: t,
    }),
    __simComposeHandle: createComposeHandle({
      controllerUrl: args.controllerUrl,
      serviceNames: args.composeServiceNames,
      execImpl: args.composeExecImpl,
      timeoutMs: t,
    }),
    __simBurstLoad: createBurstLoad({ targetUrl: burstUrl }),
    __simBffRead: createBffRead({
      bffReadUrl: args.bffReadUrl,
      timeoutMs: t,
    }),
    __simOutboxClient: createOutboxClient({
      approvalApiUrl: args.approvalApiUrl,
      requestTimeoutMs: t,
    }),
    __simBitmapMetrics: createBitmapMetrics({
      authApiUrl: args.authApiUrl,
      timeoutMs: t,
    }),
    __simBitmapVersionMutator: createBitmapVersionMutator({
      authApiUrl: args.authApiUrl,
      timeoutMs: t,
    }),
    __simBitmapVersionCheck: createBitmapVersionCheck({
      authApiUrl: args.authApiUrl,
      requestTimeoutMs: t,
    }),
    __simGatewayStickyConsistency: createGatewayStickyConsistency({
      gatewayUrl: args.gatewayUrl,
      timeoutMs: t,
    }),
    __simHandle: simHandle,
    __simGatewayFetch: createSimGatewayFetch({
      gatewayUrl: args.gatewayUrl,
    }),
  };

  const g = globalThis as unknown as Record<HandleKey, unknown>;
  for (const k of HANDLE_KEYS) {
    g[k] = handles[k];
  }
}

/**
 * unwireSimHandles — wireSimHandles로 binding된 14 handle을 모두 제거한다.
 *
 * 테스트 격리용. e2e 환경 종료 시 호출.
 */
export function unwireSimHandles(): void {
  const g = globalThis as unknown as Record<HandleKey, unknown>;
  for (const k of HANDLE_KEYS) {
    delete g[k];
  }
}

export {
  createAuditFetcher,
  createWaitForCycles,
  createCatalogStore,
  createFaultInjector,
  createComposeHandle,
  createBurstLoad,
  createBffRead,
  createOutboxClient,
  createBitmapMetrics,
  createBitmapVersionMutator,
  createBitmapVersionCheck,
  createGatewayStickyConsistency,
  createSimHandle,
  createSimGatewayFetch,
};
export type { SimHandle, SimHandleFixtures } from "./sim-handle.js";
