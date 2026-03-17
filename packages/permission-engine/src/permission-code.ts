/**
 * permission-code.ts — 전체 permission address 직렬화/파싱.
 *
 * 전체 구조:
 *   [service-ref] . [type] . [resource] . [action]
 *
 * 예시:
 *   shop/payment . api . admin/teams . GET
 *   → "shop/payment.api.admin/teams.GET"
 *
 * 전송 프로토콜별 인코딩:
 *   text   — 사람 읽기용, 디버그/로그
 *   packed — 각 파트를 정수 인코딩 (varint-like, 크기 최적화)
 */

import {
  type ServiceContext,
  type ServiceRef,
  formatServiceRef,
  parseServiceRef,
} from "./service-ref.js";
import {
  canonicalizeResource,
  type ResourceType,
} from "./resource.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** permission code의 구조화된 표현. */
export interface PermissionCode {
  /** 서비스 참조 (namespace/name). */
  readonly service: string;
  /** resource 타입. */
  readonly type: ResourceType;
  /** canonical resource path. */
  readonly resource: string;
  /** 행동. */
  readonly action: string;
}

// ── Text protocol ────────────────────────────────────────────────────────────

// 구분자: `.` 을 사용하되, resource 내부의 `/`와 충돌하지 않음
// format: {service}.{type}.{resource}.{action}
// 주의: resource에 `.`이 없으므로 파싱이 unambiguous

/**
 * PermissionCode → text 직렬화.
 *
 * @example
 * formatPermCode({
 *   service: "shop/payment",
 *   type: "api",
 *   resource: "admin/teams",
 *   action: "GET",
 * })
 * // → "shop/payment.api.admin/teams.GET"
 */
export function formatPermCode(code: PermissionCode): string {
  return `${code.service}.${code.type}.${code.resource}.${code.action}`;
}

/**
 * text → PermissionCode 파싱.
 *
 * 파싱 전략:
 *   1. 첫 번째 `.` → service (namespace/name, `/` 포함 가능)
 *   2. 두 번째 `.` → type
 *   3. 마지막 `.` → action
 *   4. 중간 전부 → resource (내부에 `.`이 없으므로 안전)
 */
export function parsePermCode(raw: string): PermissionCode {
  // 첫 `.` 이후 split
  const firstDot = raw.indexOf(".");
  if (firstDot < 0) throw new RangeError(`Invalid permission code "${raw}": service.type.resource.action 형식 필요`);

  const service = raw.slice(0, firstDot);

  const rest = raw.slice(firstDot + 1);
  // type은 다음 `.`까지
  const typeDot = rest.indexOf(".");
  if (typeDot < 0) throw new RangeError(`Invalid permission code "${raw}": type.resource.action 부분 없음`);

  const type = rest.slice(0, typeDot);

  const afterType = rest.slice(typeDot + 1);
  // action은 마지막 `.` 이후
  const lastDot = afterType.lastIndexOf(".");
  if (lastDot < 0) throw new RangeError(`Invalid permission code "${raw}": resource.action 구분 없음`);

  const resource = afterType.slice(0, lastDot);
  const action = afterType.slice(lastDot + 1);

  if (!service || !type || !resource || !action) {
    throw new RangeError(`Invalid permission code "${raw}": 빈 파트 존재`);
  }

  return { service, type, resource, action };
}

// ── Context-bound helpers ────────────────────────────────────────────────────

/**
 * ServiceContext를 바인딩한 permission code 생성 헬퍼.
 *
 * SDK 초기화 후 service 부분을 매번 지정하지 않아도 됨.
 *
 * @example
 * const ctx = createServiceContext({ namespace: "shop", name: "payment", env: "prod" });
 * const perm = createPermCodeFactory(ctx);
 *
 * perm("api", "admin/teams", "GET");
 * // → { service: "shop/payment", type: "api", resource: "admin/teams", action: "GET" }
 *
 * perm.format("api", "admin/teams", "GET");
 * // → "shop/payment.api.admin/teams.GET"
 */
export interface PermCodeFactory {
  (type: ResourceType, resource: string, action: string): PermissionCode;
  format(type: ResourceType, resource: string, action: string): string;
}

export function createPermCodeFactory(ctx: ServiceContext): PermCodeFactory {
  const service = ctx.ref();

  const factory = (
    type: ResourceType,
    resource: string,
    action: string,
  ): PermissionCode => {
    const canonical = canonicalizeResource(resource);
    return { service, type, resource: canonical, action };
  };

  factory.format = (
    type: ResourceType,
    resource: string,
    action: string,
  ): string => {
    return formatPermCode(factory(type, resource, action));
  };

  return factory;
}
