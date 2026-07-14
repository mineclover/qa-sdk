// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { env } from '../config/env.js';

/**
 * 컨테이너 자기 정체성.
 *
 * Dockerfile ARG SERVICE_VERSION → ENV SIM_SERVICE_VERSION → 본 상수.
 *
 * spec 02-canary-topology.md §4.1 — "모든 응답 헤더, 모든 outbox event payload,
 * 모든 audit log entry에 serviceVersion: SIM_SERVICE_VERSION 을 첨부한다".
 */
export const SERVICE_VERSION: string = env.SIM_SERVICE_VERSION;

/** outbox event/audit entry payload에 첨부할 stamp. */
export interface ServiceVersionStamp {
  readonly serviceVersion: string;
}

/**
 * 임의 payload에 현재 컨테이너 버전을 첨부한다.
 *
 * spec 02 §4.1 인용: stamp는 필수 — 누락되면 ingest 측 stamp gate에서 차단된다.
 */
export function withServiceVersion<T extends object>(payload: T): T & ServiceVersionStamp {
  return { ...payload, serviceVersion: SERVICE_VERSION };
}
