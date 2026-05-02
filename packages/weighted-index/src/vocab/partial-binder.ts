// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * partial-binder.ts — 차원 부분 바인딩 (curried encoder).
 *
 * ## 문제
 *
 * 전체 경로가 N개 차원일 때:
 *   namespace > name > env > device > region > shard > resource > action
 *
 * SDK가 앱 부트 시 앞쪽 차원(namespace, name, env, device)을 고정하고,
 * 런타임에 나머지(region, shard, resource, action)만 받아서
 * 최종 1D 주소를 계산해야 한다.
 *
 * ## 해결
 *
 * PartialBinder가 고정 차원을 캐시하고, resolve() 시 나머지만 받아 합산한다.
 *
 *   const binder = createBinder(codec, "full", { namespace: "shop", ... });
 *   const addr = binder.resolve({ region: "asia", resource: "res-5", action: "POST" });
 *
 * ## 원리 (참조: calc.ts partialQueryBase)
 *
 * mixed-radix 인코딩에서 각 차원의 기여분은 독립적이다:
 *   address = Σ (coord[i] - 1) × stride[i]
 *
 * 고정 차원의 기여분(base)을 한 번만 계산해 캐시하면,
 * resolve() 호출마다 자유 차원의 기여분만 계산 후 합산하면 된다.
 * 이것이 partialQueryBase(weights, fixedCoords)의 원리다.
 *
 * ## PrefixCodec 연동
 *
 * PrefixCodec은 LabelRegistry를 통해 엔티티 ID → 1-based 인덱스 변환을 제공한다.
 * PartialBinder는 PrefixCodec.encodeFromIds()와 동일한 변환을 수행하되,
 * 고정 차원을 매번 전달하지 않아도 되는 편의를 제공한다.
 *
 * ## 사용 패턴
 *
 * ### 1. SDK 컨텍스트 고정
 * ```ts
 * const sdk = createBinder(codec, "full", {
 *   namespace: "shop", name: "payment", env: "prod", device: "web",
 * });
 * // sdk.free → ["region", "shard", "resource", "action"]
 * const addr = sdk.resolveId({ region: "asia", shard: "s2", resource: "orders", action: "GET" });
 * ```
 *
 * ### 2. 점진적 체이닝
 * ```ts
 * const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
 * const step2 = step1.bind({ env: "prod", device: "web" });
 * const step3 = step2.bind({ region: "asia", shard: "s2" });
 * const addr = step3.resolveId({ resource: "config", action: "DELETE" });
 * ```
 *
 * ### 3. 멀티서비스 — 같은 codec, 다른 binder
 * ```ts
 * const paymentSDK = createBinder(codec, "full", { namespace: "shop", name: "payment", ... });
 * const authSDK    = createBinder(codec, "full", { namespace: "shop", name: "auth", ... });
 * // 같은 remaining을 넣어도 서비스 다르면 주소 다름
 * ```
 *
 * ### 4. prefix별 독립 binder
 * ```ts
 * const svcBinder  = createBinder(codec, "svc", { namespace: "shop" });
 * const permBinder = createBinder(codec, "perm", { resource: "orders" });
 * ```
 */

import { PrefixCodec } from "./prefix-registry.js";
import type { EntityId } from "./label-registry.js";
import type { VersionedIndex } from "./prefix-registry.js";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * 부분 바인딩된 인코더.
 *
 * bind 시점에 고정한 차원을 캐시하고,
 * resolve() 호출 시 나머지 차원만 받아 최종 주소를 계산한다.
 */
export interface PartialBinder {
  /** 고정된 라벨과 값. */
  readonly bound: Readonly<Record<string, EntityId>>;
  /** 아직 바인딩되지 않은(자유) 라벨 목록. */
  readonly free: readonly string[];
  /** prefix 이름. */
  readonly prefix: string;
  /** prefix 버전. */
  readonly version: string;

  /**
   * 자유 차원을 받아 VersionedIndex 반환.
   *
   * @param remaining - free 라벨에 해당하는 엔티티 ID 매핑.
   * @throws {RangeError} free 라벨 누락 시
   */
  resolve(remaining: Record<string, EntityId>): VersionedIndex;

  /**
   * 자유 차원을 받아 integer address만 반환. (resolve().id 단축)
   */
  resolveId(remaining: Record<string, EntityId>): number;

  /**
   * 추가 차원을 고정하여 새 PartialBinder 반환 (체이닝).
   */
  bind(additional: Record<string, EntityId>): PartialBinder;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * PrefixCodec 기반 PartialBinder 생성.
 *
 * @param codec - PrefixCodec 인스턴스 (LabelRegistry + prefix 정의 포함)
 * @param prefix - 대상 prefix 이름 (예: "full", "svc", "perm")
 * @param fixed - 고정할 라벨 → 엔티티 ID 매핑 (예: `{ namespace: "shop", name: "payment" }`)
 * @param version - prefix 버전 (미지정 시 최신)
 */
export function createBinder(
  codec: PrefixCodec,
  prefix: string,
  fixed: Record<string, EntityId>,
  version?: string,
): PartialBinder {
  const v = version ?? codec.getCurrentVersion(prefix);
  const allLabels = codec.getLabels(prefix);

  // 고정된 라벨 검증
  const boundKeys = new Set(Object.keys(fixed));
  for (const key of boundKeys) {
    if (!allLabels.includes(key)) {
      throw new RangeError(
        `Unknown label "${key}" for prefix "${prefix}". Valid: [${allLabels.join(", ")}]`
      );
    }
  }

  const freeLabels = allLabels.filter(l => !boundKeys.has(l));

  function _resolve(remaining: Record<string, EntityId>): VersionedIndex {
    for (const label of freeLabels) {
      if (remaining[label] === undefined) {
        throw new RangeError(
          `Missing label "${label}" in resolve(). Expected: [${freeLabels.join(", ")}]`
        );
      }
    }
    const merged: Record<string, EntityId> = { ...fixed };
    for (const label of freeLabels) {
      merged[label] = remaining[label];
    }
    return codec.encodeFromIds(prefix, merged, v);
  }

  return {
    bound: { ...fixed },
    free: freeLabels,
    prefix,
    version: v,

    resolve(remaining) {
      return _resolve(remaining);
    },

    resolveId(remaining) {
      return _resolve(remaining).id;
    },

    bind(additional) {
      return createBinder(codec, prefix, { ...fixed, ...additional }, v);
    },
  };
}
