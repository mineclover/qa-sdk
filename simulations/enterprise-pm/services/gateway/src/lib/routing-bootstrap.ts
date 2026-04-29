// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.2 — controller 재시작 시 gateway가 권위. 부팅 시에는 controller에서 sync 시도.
// 실패 시 fail-open fallback (revision=0, v1 stable, weight=0).

import { z } from "zod";
import {
  InMemoryRoutingStore,
  RouteEntrySchema,
  type RouteEntry,
} from "../routing/routing-table.js";

/** service name → { v1, v2 } upstream URL map. v1 = stable seed; v2 = candidate (사용 X — fallback은 stable-only). */
export type FallbackTargets = Record<string, { v1: string; v2?: string }>;

export interface BootstrapRoutingArgs {
  store: InMemoryRoutingStore;
  /** controller GET /controller/routing endpoint base URL. undefined → controller 미가동, 즉시 fallback. */
  controllerUrl: string | undefined;
  /** controller 미가동 시 store seed에 쓸 service→{v1,v2} URL map. */
  fallbackTargets: FallbackTargets;
  /** controller fetch timeout (ms). CLAUDE.md 네트워크 호출 규약에 따라 5_000 권장. */
  fetchTimeoutMs: number;
  /** logger (서비스 측 inject). console.* 금지 — 미주입 시 silent. */
  logger?: {
    info: (obj: Record<string, unknown>, msg: string) => void;
    warn: (obj: Record<string, unknown>, msg: string) => void;
  };
}

export interface BootstrapResult {
  /** "controller" — controller에서 sync 성공. "fallback" — controller 미가동/오류로 fallback seed. */
  source: "controller" | "fallback";
  /** store에 적용된 service 이름들. */
  applied: string[];
  /** fallback인 경우 사유. */
  reason?: "no-url" | "timeout" | "non-200" | "malformed-json" | "schema-mismatch" | "fetch-failure";
}

const ControllerResponseSchema = z.object({
  routes: z.record(z.string().min(1), RouteEntrySchema),
});

/**
 * fallback seed: 등록된 모든 fallbackTargets 서비스에 대해
 * `{ revision: 0, stable: { version: "v1", upstream: targets.v1 }, candidate: null, weight: 0 }` 생성.
 */
export function buildFallbackSeed(targets: FallbackTargets): Record<string, RouteEntry> {
  const seed: Record<string, RouteEntry> = {};
  for (const [name, urls] of Object.entries(targets)) {
    seed[name] = {
      revision: 0,
      stable: { version: "v1", upstream: urls.v1 },
      candidate: null,
      weight: 0,
      stickyKey: "user_id",
    };
  }
  return seed;
}

function applySeed(store: InMemoryRoutingStore, seed: Record<string, RouteEntry>): string[] {
  const applied: string[] = [];
  for (const [name, entry] of Object.entries(seed)) {
    const result = store.upsertRoute(name, entry);
    if (result.applied) applied.push(name);
  }
  return applied;
}

function fallback(
  store: InMemoryRoutingStore,
  fallbackTargets: FallbackTargets,
  reason: BootstrapResult["reason"],
  logger: BootstrapRoutingArgs["logger"],
): BootstrapResult {
  const seed = buildFallbackSeed(fallbackTargets);
  const applied = applySeed(store, seed);
  logger?.warn(
    { reason, services: applied },
    `routing-bootstrap: controller sync failed, fallback seed applied`,
  );
  return { source: "fallback", applied, reason };
}

/**
 * 부팅 시 controller에서 routing sync 시도. 실패 시 fail-open fallback.
 *
 * 절대 throw 하지 않는다 (gateway 부팅을 차단하지 않기 위해).
 */
export async function bootstrapRouting(args: BootstrapRoutingArgs): Promise<BootstrapResult> {
  const { store, controllerUrl, fallbackTargets, fetchTimeoutMs, logger } = args;

  if (!controllerUrl) {
    return fallback(store, fallbackTargets, "no-url", logger);
  }

  const target = new URL("/controller/routing", controllerUrl).toString();
  let response: Response;
  try {
    response = await fetch(target, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });
  } catch (err) {
    const name = (err as Error).name;
    const reason: BootstrapResult["reason"] =
      name === "AbortError" || name === "TimeoutError" ? "timeout" : "fetch-failure";
    return fallback(store, fallbackTargets, reason, logger);
  }

  if (!response.ok) {
    return fallback(store, fallbackTargets, "non-200", logger);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return fallback(store, fallbackTargets, "malformed-json", logger);
  }

  const parsed = ControllerResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return fallback(store, fallbackTargets, "schema-mismatch", logger);
  }

  const applied: string[] = [];
  for (const [name, entry] of Object.entries(parsed.data.routes)) {
    const result = store.upsertRoute(name, entry);
    if (result.applied) applied.push(name);
  }
  logger?.info(
    { services: applied, controllerUrl: target },
    "routing-bootstrap: controller sync ok",
  );
  return { source: "controller", applied };
}
