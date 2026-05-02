// @def.boundary gate-system
// @def.doc gate-system

/**
 * Consistency 서비스 — E-4.
 *
 * gate-service의 일관성 모델을 구현한다:
 *
 * 1. shouldVerify 재확인 흐름:
 *    캐시 기반 checkGate가 shouldVerify=true(open 상태)를 반환하면,
 *    클라이언트가 verifyGate()를 호출하여 primary(GateEngine)에서 직접 재계산 후 확인한다.
 *
 * 2. Primary direct lookup:
 *    GateEngine이 있으면 캐시를 우회하여 직접 recompute + 확인을 수행한다.
 *    GateEngine이 없으면(읽기 전용 캐시 모드) 캐시 결과를 그대로 반환한다.
 *
 * gate-service = 읽기 전용 캐시 서비스이므로, primary lookup은
 * "recompute → 캐시 갱신 → 재조회" 시퀀스로 구현한다.
 */

import type { GateResult, AddressState } from "index-meta-workers";
import type { GateLookupService } from "../lib/gate-service.js";

export interface ConsistencyServiceDeps {
  gateService: GateLookupService;
  /** 에러 로그 콜백 */
  onError?: (error: unknown, context: string) => void;
}

export interface VerifyResult {
  /** 캐시 기반 결과 */
  readonly cached: GateResult;
  /** primary 재확인 결과 (engine 없으면 cached와 동일) */
  readonly verified: GateResult;
  /** 캐시와 primary 결과가 다른지 여부 */
  readonly drifted: boolean;
}

export interface ConsistencyService {
  /**
   * shouldVerify 재확인 흐름.
   *
   * 1. 캐시에서 checkGate 조회
   * 2. shouldVerify=true이면 primary recompute → 재조회
   * 3. 캐시 vs primary 결과 비교하여 drift 여부 반환
   *
   * engine이 없으면 캐시 결과를 그대로 반환 (drifted=false).
   */
  verifyGate(
    prefix: string,
    versionId: string,
    address: number,
  ): Promise<VerifyResult>;

  /**
   * Primary direct lookup — 캐시 우회.
   *
   * engine이 있으면 recompute → 재조회로 최신 상태를 보장한다.
   * engine이 없으면 캐시 결과를 반환한다 (fail-open).
   */
  directLookup(
    prefix: string,
    versionId: string,
    address: number,
  ): Promise<GateResult>;

  /**
   * Primary direct classify — 캐시 우회.
   */
  directClassify(
    prefix: string,
    versionId: string,
    address: number,
  ): Promise<AddressState>;
}

export function createConsistencyService(
  deps: ConsistencyServiceDeps,
): ConsistencyService {
  const { gateService, onError } = deps;

  async function recomputeIfPossible(prefix: string, versionId: string): Promise<boolean> {
    if (!gateService.engine) return false;

    try {
      await gateService.recompute(prefix, versionId);
      return true;
    } catch (err) {
      // fail-open: recompute 실패 시 캐시 결과 사용
      onError?.(err, `primary recompute: ${prefix}/${versionId}`);
      return false;
    }
  }

  return {
    async verifyGate(
      prefix: string,
      versionId: string,
      address: number,
    ): Promise<VerifyResult> {
      const cached = await gateService.checkGate(prefix, versionId, address);

      // shouldVerify=false → 캐시 결과 신뢰
      if (!cached.shouldVerify) {
        return { cached, verified: cached, drifted: false };
      }

      // engine 없으면 primary 확인 불가 — 캐시 결과 반환
      if (!gateService.engine) {
        return { cached, verified: cached, drifted: false };
      }

      // primary recompute → 캐시 갱신 → 재조회
      const recomputed = await recomputeIfPossible(prefix, versionId);
      if (!recomputed) {
        return { cached, verified: cached, drifted: false };
      }

      const verified = await gateService.checkGate(prefix, versionId, address);
      const drifted =
        cached.state !== verified.state ||
        cached.encode !== verified.encode ||
        cached.decode !== verified.decode;

      return { cached, verified, drifted };
    },

    async directLookup(
      prefix: string,
      versionId: string,
      address: number,
    ): Promise<GateResult> {
      await recomputeIfPossible(prefix, versionId);
      return gateService.checkGate(prefix, versionId, address);
    },

    async directClassify(
      prefix: string,
      versionId: string,
      address: number,
    ): Promise<AddressState> {
      await recomputeIfPossible(prefix, versionId);
      return gateService.classifyAddress(prefix, versionId, address);
    },
  };
}
