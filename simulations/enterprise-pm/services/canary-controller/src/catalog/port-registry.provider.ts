// @def.boundary sim-canary-controller
// spec 2026-05-02 §7 — PortRegistryPort 기본 구현 + DI provider.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.11
//
// 시뮬 docker-compose 환경에서 service container 이름 → upstream URL 합성.
// 운영 환경에서는 service-discovery / DNS 사용. 본 sub-project 범위는 시뮬 내부.

import { type Provider } from "@nestjs/common";
import { type PortRegistryPort } from "../action/action-executor.service.js";
import { PORT_REGISTRY_TOKEN } from "./tokens.js";

const APPROVAL_API_PORT = 4600;

export class SimPortRegistry implements PortRegistryPort {
  /**
   * sim-<service>-v<n> → http://sim-<service>-api-v<n>:4600
   * (시뮬에서는 service container 가 docker network 내부에서 4600 포트로 expose).
   */
  getUpstream(serviceContainer: string): string {
    // Convention: sim-<service>-v<n>  →  http://sim-<service>-api-v<n>:4600
    // 예: sim-approval-v1 → http://sim-approval-api-v1:4600
    const m = /^sim-([a-z0-9-]+)-v(\d+)$/.exec(serviceContainer);
    if (m) {
      return `http://sim-${m[1]}-api-v${m[2]}:${APPROVAL_API_PORT}`;
    }
    // fallback: identity URL with default port (시뮬 외부 host name 직접 사용 시).
    return `http://${serviceContainer}:${APPROVAL_API_PORT}`;
  }
}

export const portRegistryProvider: Provider = {
  provide: PORT_REGISTRY_TOKEN,
  useFactory: () => new SimPortRegistry(),
};
