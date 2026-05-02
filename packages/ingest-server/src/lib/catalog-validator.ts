// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * 카탈로그 기반 데이터 추적성 검증.
 *
 * event-catalog의 이벤트 선언과 catalog의 prefix 선언을 기반으로
 * ingest 경계에서 데이터 정합성을 검증한다.
 *
 * 전략: fail-open (검증 실패 → warning + 통과. 이벤트 유실보다 경고가 낫다)
 */
import type { Logger } from "pino";

/** eventKey 검증 결과 */
export interface EventKeyValidation {
  /** 등록된 이벤트인지 여부 */
  readonly known: boolean;
  /** core event인지 여부 (event-catalog 미로드 시 undefined) */
  readonly isCoreEvent?: boolean;
}

/** prefix 검증 결과 */
export interface PrefixValidation {
  /** 카탈로그에 없는 prefix 목록 */
  readonly unknownPrefixes: readonly string[];
}

export interface CatalogValidator {
  /** eventKey가 등록된 이벤트인지 검증. 미등록 → warning 로그 */
  validateEventKey(eventKey: string): EventKeyValidation;

  /** addressContext의 prefix들이 카탈로그에 존재하는지 검증 */
  validatePrefixes(addressContext: Record<string, string> | null | undefined): PrefixValidation;
}

export interface CatalogValidatorOptions {
  /** 카탈로그에 정의된 prefix ID 집합 */
  knownPrefixes: ReadonlySet<string>;
  /** event-catalog의 isCoreEvent 함수 (외부에서 주입) */
  isCoreEvent?: (eventKey: string) => boolean;
  logger?: Logger;
}

/**
 * CatalogValidator를 생성한다.
 *
 * event-catalog의 isCoreEvent는 호출 측에서 동적 import 후 주입한다.
 * prefix 검증은 knownPrefixes Set 기반.
 */
export function createCatalogValidator(
  options: CatalogValidatorOptions,
): CatalogValidator {
  const { knownPrefixes, isCoreEvent, logger } = options;

  if (isCoreEvent) {
    logger?.info("event-catalog eventKey 검증 활성화");
  } else {
    logger?.info("event-catalog 미제공 — eventKey 검증 비활성화 (모든 이벤트 허용)");
  }

  return {
    validateEventKey(eventKey: string): EventKeyValidation {
      if (!isCoreEvent) {
        // event-catalog 미제공 → 모든 이벤트 허용
        return { known: true };
      }

      const isCoreResult = isCoreEvent(eventKey);
      return {
        known: isCoreResult,
        isCoreEvent: isCoreResult,
      };
    },

    validatePrefixes(
      addressContext: Record<string, string> | null | undefined,
    ): PrefixValidation {
      if (!addressContext || knownPrefixes.size === 0) {
        return { unknownPrefixes: [] };
      }

      const unknown: string[] = [];
      for (const prefixId of Object.keys(addressContext)) {
        if (!knownPrefixes.has(prefixId)) {
          unknown.push(prefixId);
        }
      }
      return { unknownPrefixes: unknown };
    },
  };
}
