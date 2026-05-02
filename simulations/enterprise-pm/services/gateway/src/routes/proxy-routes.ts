// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono, type Context } from "hono";
import { parseVersionTag, type VersionTag } from "sim-identifier-grammar";
import { proxyRequest } from "../lib/proxy.js";
import type { InMemoryRoutingStore } from "../routing/routing-table.js";
import { decideRoute } from "../routing/route-decision.js";
import type { CanaryOverride } from "../middleware/canary-override.js";

/**
 * 라우팅 종류:
 *  - "prefix": `/path` + `/path/*` 둘 다 매칭. `/projects`, `/projects/123` 모두 한 서비스로.
 *  - "exact" : path-param 을 포함한 정확한 패턴. `/users/:userId/projects` 같이
 *              wildcard suffix 가 붙으면 다른 슬라이스의 같은 prefix(`/users/:userId/notifications`)
 *              와 충돌하므로 specific pattern 으로만 매칭.
 *
 *  결정 근거: auth-api 의 `/users` 는 gateway 우회 (login.ts 직접 호출). 따라서
 *  `/users/:userId/<resource>` 형태의 specific path 는 pm-api/notification-api 가
 *  나눠 쓸 수 있다. 두 서비스가 동일 user prefix 를 공유해도 leaf path 가 다르므로
 *  exact 패턴으로 분리 라우팅.
 */
export type ProxyKind = "prefix" | "exact";

export interface ProxyTarget {
  /**
   * gateway path.
   *  - kind="prefix": `/projects` (자동으로 `/projects/*` 도 매칭)
   *  - kind="exact" : `/users/:userId/projects` (정확 매칭만)
   */
  path: string;
  serviceKey: string;
  description: string;
  /** 기본 "prefix". path-param exact 라우팅은 "exact". */
  kind?: ProxyKind;
}

export const PROXY_TARGETS: readonly ProxyTarget[] = [
  // --- 기존 6 서비스 prefix ---
  { path: "/projects", serviceKey: "sim-pm-api", description: "PM domain — projects" },
  { path: "/approvals", serviceKey: "sim-approval-api", description: "Approval workflows — budget" },
  { path: "/notifications", serviceKey: "sim-notification-api", description: "Notifications" },
  { path: "/reports", serviceKey: "sim-reporting-api", description: "Reporting" },
  { path: "/documents", serviceKey: "sim-document-api", description: "Documents" },
  { path: "/audit", serviceKey: "sim-audit-browser-api", description: "Audit explorer" },

  // --- pm-api 추가 슬라이스 ---
  { path: "/tasks", serviceKey: "sim-pm-api", description: "PM domain — tasks" },
  { path: "/assignments", serviceKey: "sim-pm-api", description: "PM domain — assignments (NB: auth-api role-assignments 는 우회)" },
  { path: "/members", serviceKey: "sim-pm-api", description: "PM domain — project members" },
  // path-param specific — auth-api `/users` 와 leaf path 로 분리
  { path: "/users/:userId/projects", serviceKey: "sim-pm-api", description: "PM domain — user's projects", kind: "exact" },

  // --- approval-api 추가 슬라이스 ---
  { path: "/expense-reports", serviceKey: "sim-approval-api", description: "Approval — expense reports" },
  { path: "/resource-requests", serviceKey: "sim-approval-api", description: "Approval — resource requests" },
  { path: "/time-off-requests", serviceKey: "sim-approval-api", description: "Approval — time off requests" },

  // --- notification-api 추가 슬라이스 ---
  { path: "/subscriptions", serviceKey: "sim-notification-api", description: "Notification — subscriptions" },
  { path: "/users/:userId/notifications", serviceKey: "sim-notification-api", description: "Notification — user's notifications", kind: "exact" },
  { path: "/users/:userId/subscriptions", serviceKey: "sim-notification-api", description: "Notification — user's subscriptions", kind: "exact" },

  // --- reporting-api 추가 슬라이스 ---
  { path: "/metrics", serviceKey: "sim-reporting-api", description: "Reporting — metrics" },
  { path: "/density", serviceKey: "sim-reporting-api", description: "Reporting — density" },

  // --- BFF read-model (옵션 A: 슬라이스별 path 추가) ---
  // 이유: 7 BFF resource (assignments / budget-requests / expense-reports / resource-requests /
  // time-off-requests / notifications / subscriptions) 가 모두 unique 하고, controller path
  // 를 변경하지 않으려면 slice 별 path 추가가 가장 단순. `/bff/<resource>` 형태 유지.
  { path: "/bff/assignments", serviceKey: "sim-pm-api", description: "BFF — assignment detail (pm-api)" },
  { path: "/bff/budget-requests", serviceKey: "sim-approval-api", description: "BFF — budget request detail" },
  { path: "/bff/expense-reports", serviceKey: "sim-approval-api", description: "BFF — expense report detail" },
  { path: "/bff/resource-requests", serviceKey: "sim-approval-api", description: "BFF — resource request detail" },
  { path: "/bff/time-off-requests", serviceKey: "sim-approval-api", description: "BFF — time off request detail" },
  { path: "/bff/notifications", serviceKey: "sim-notification-api", description: "BFF — notification detail" },
  { path: "/bff/subscriptions", serviceKey: "sim-notification-api", description: "BFF — subscription detail" },
];

export interface CreateProxyRoutesOptions {
  /** serviceKey → base URL. PROXY_TARGETS의 모든 serviceKey가 등록되어야 함. */
  targets: Record<string, string>;
  timeoutMs: number;
  /**
   * Plan C 단계 7 — controller가 push한 라우팅 store. 등록되지 않은 serviceKey는
   * `targets[serviceKey]`로 fall-through (legacy 호환). Task 7.8에서 routing decision
   * 호출이 추가된다.
   */
  routingStore?: InMemoryRoutingStore;
}

export function createProxyRoutes(opts: CreateProxyRoutesOptions) {
  const r = new Hono();
  for (const target of PROXY_TARGETS) {
    const fallbackBase = opts.targets[target.serviceKey];
    if (!fallbackBase) {
      throw new Error(
        `createProxyRoutes: target ${target.serviceKey} URL missing`,
      );
    }
    const handler = async (c: Context) => {
      const url = new URL(c.req.url);

      // Plan C 단계 7 — routing decision 흐름:
      //   1. routingStore + entry 존재 → decideRoute (sticky-by-user) 또는 escape hatch.
      //   2. 미존재 → legacy fall-through (기존 시나리오 1~8 무회귀).
      const entry = opts.routingStore?.getRoute(target.serviceKey);
      let targetBaseUrl = fallbackBase;
      let targetVersion: VersionTag | undefined;

      if (entry) {
        const override = c.get("canary-override") as CanaryOverride | undefined;
        if (override) {
          // spec §3.4 — internal IP에서 검증된 강제 라우팅.
          const pair = override.target === "candidate" ? entry.candidate : entry.stable;
          if (pair) {
            targetBaseUrl = pair.upstream;
            targetVersion = parseVersionTag(pair.version);
          }
        } else {
          const userId = c.req.raw.headers.get("x-auth-user-id") ?? undefined;
          const decision = decideRoute({ entry, userId });
          targetBaseUrl = decision.upstream;
          targetVersion = parseVersionTag(decision.version);
        }
      }

      return proxyRequest({
        targetBaseUrl,
        sourcePath: url.pathname + url.search,
        request: c.req.raw,
        timeoutMs: opts.timeoutMs,
        targetVersion,
      });
    };
    const kind: ProxyKind = target.kind ?? "prefix";
    if (kind === "exact") {
      // path-param specific. wildcard suffix 없이 정확 매칭.
      r.all(target.path, handler);
    } else {
      // prefix. `/path` + `/path/*` 둘 다 등록.
      r.all(`${target.path}/*`, handler);
      r.all(target.path, handler);
    }
  }
  return r;
}
