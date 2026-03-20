/**
 * QaContext — DSL DB 앱 코드 진입점.
 *
 * 환경 변수(env, region, service, namespace)를 주입하여
 * 개발자가 비즈니스 차원만 다루게 한다.
 *
 * 사용:
 *   const qa = createQaContext({ env: "prod", region: "asia", ... });
 *   qa.encode("permission", { role: "admin" })  // 환경 차원 자동 포함
 *   qa.decode("permission:v1:65536")             // 문자열로 복원
 *   qa.resolve("permission:v1:5")                // 자동 마이그레이션
 */

import type { DemoCatalog } from "demo-snapshot";
import { encodePrefixByValue, decodePrefix, resolveAddress } from "demo-snapshot";

/** 실행 모드 */
export type ExecutionMode = "live" | "test" | "synthetic" | "replay";

export interface QaContextConfig {
  /** 배포 환경 (default: process.env.QA_ENV ?? "dev") */
  env?: string;
  /** 서비스 리전 (default: process.env.QA_REGION ?? "asia") */
  region?: string;
  /** 서비스 이름 (default: process.env.QA_SERVICE ?? "unknown") */
  service?: string;
  /** 네임스페이스 (default: process.env.QA_NAMESPACE ?? "default") */
  namespace?: string;
  /** 카탈로그 (default: DEMO_CATALOG) */
  catalog?: DemoCatalog;
  /** 실행 모드 (default: "live") */
  executionMode?: ExecutionMode;
  /** 실행 식별자 — 테스트 suite ID 등 */
  executionId?: string;
}

/** DSL 세션 — useDsl() 반환값 */
export interface DslSession {
  /** DSL 번들 ID */
  readonly dslId: string;
  /** DSL 멤버 prefix 목록 */
  readonly memberPrefixes: readonly string[];
  /** track — DSL 멤버만 허용, 누락 경고 포함 */
  track(prefixes: Record<string, Record<string, string | number>>): {
    address_context: Record<string, string>;
    warnings: readonly string[];
  };
}

export interface QaContext {
  /** 환경 설정 */
  readonly config: Readonly<Required<Pick<QaContextConfig, "env" | "region" | "service" | "namespace">>>;

  /** 인코딩: 비즈니스 차원만 지정 → prefix:version:address */
  encode(prefix: string, dims: Record<string, string | number>, version?: string): string;

  /** 디코딩: prefix:version:address → 문자열 값 */
  decode(serialized: string): Record<string, string | number>;

  /** 자동 마이그레이션: 구버전 → 최신 */
  resolve(serialized: string): { address: string; values: Record<string, string | number>; migrated: boolean };

  /** 서비스 주소 (현재 env/region/service/namespace의 정수 주소) */
  serviceAddress(): number;

  /**
   * 이벤트 추적 — encode + address_context 자동 생성.
   *
   * 여러 prefix를 한번에 태깅할 수 있다.
   * 반환된 address_context를 QaLogger.log()에 전달하면 된다.
   */
  track(prefixes: Record<string, Record<string, string | number>>): {
    address_context: Record<string, string>;
    addresses: Record<string, { prefix: string; version: string; address: number }>;
  };

  /**
   * address_context에서 의미값을 복원한다.
   */
  readContext(address_context: Record<string, string>): Record<string, Record<string, string | number>>;

  /** 실행 모드 (live/test/synthetic/replay) */
  readonly executionMode: ExecutionMode;

  /** 실행 식별자 */
  readonly executionId?: string;

  /**
   * DSL 모드 — 특정 DSL 번들의 멤버 prefix만 사용 허용.
   *
   * @param dslId - DSL 번들 ID (예: "dsl-checkout")
   * @param memberPrefixes - 멤버 prefix 목록 (DslBundleNode.memberPrefixes)
   */
  useDsl(dslId: string, memberPrefixes: readonly string[]): DslSession;
}

export function createQaContext(userConfig?: QaContextConfig): QaContext {
  const config = {
    env: userConfig?.env ?? process.env.QA_ENV ?? "dev",
    region: userConfig?.region ?? process.env.QA_REGION ?? "asia",
    service: userConfig?.service ?? process.env.QA_SERVICE ?? "unknown",
    namespace: userConfig?.namespace ?? process.env.QA_NAMESPACE ?? "default",
  };

  // dynamic import를 피하기 위해 catalog를 인자로 받음
  let catalog: DemoCatalog;
  try {
    catalog = userConfig?.catalog ?? require("demo-snapshot").DEMO_CATALOG;
  } catch {
    throw new Error("DEMO_CATALOG not available. Pass catalog in config.");
  }

  // 서비스 주소 캐시
  let _svcAddr: number | null = null;

  const getServiceAddr = (): number => {
    if (_svcAddr !== null) return _svcAddr;
    _svcAddr = encodePrefixByValue(catalog, "service", "v1", {
      env: config.env,
      region: config.region,
      svc_name: config.service,
      namespace: config.namespace,
    });
    return _svcAddr;
  };

  return {
    config,

    encode(prefix: string, dims: Record<string, string | number>, version?: string): string {
      const prefixDef = catalog.prefixes[prefix as keyof typeof catalog.prefixes];
      if (!prefixDef) throw new Error(`Unknown prefix: ${prefix}`);
      const ver = version ?? prefixDef.versions[prefixDef.versions.length - 1].version;

      // prefix_ref 차원이 있고 dims에 안 넣었으면 자동 주입
      const fullDims = { ...dims };
      for (const [label, dimRef] of Object.entries(prefixDef.dims)) {
        if (dimRef.kind === "prefix_ref" && !(label in fullDims)) {
          // service prefix_ref → 현재 service 주소 자동 주입
          if (dimRef.prefixId === "service") {
            fullDims[label] = getServiceAddr();
          }
        }
      }

      const address = encodePrefixByValue(catalog, prefix, ver, fullDims);
      return `${prefix}:${ver}:${address}`;
    },

    decode(serialized: string): Record<string, string | number> {
      const [prefixId, version, addrStr] = serialized.split(":");
      const address = Number(addrStr);
      const decoded = decodePrefix(catalog, prefixId, version, address);
      return Object.fromEntries(
        Object.entries(decoded).map(([k, v]) => [k, v.value]),
      );
    },

    resolve(serialized: string) {
      const [prefixId, version, addrStr] = serialized.split(":");
      const address = Number(addrStr);
      const prefixDef = catalog.prefixes[prefixId as keyof typeof catalog.prefixes];
      if (!prefixDef) throw new Error(`Unknown prefix: ${prefixId}`);
      const latest = prefixDef.versions[prefixDef.versions.length - 1].version;

      if (version === latest) {
        const decoded = decodePrefix(catalog, prefixId, version, address);
        return {
          address: serialized,
          values: Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.value])),
          migrated: false,
        };
      }

      // 구버전 → decode → re-encode
      const decoded = decodePrefix(catalog, prefixId, version, address);
      const values = Object.fromEntries(
        Object.entries(decoded).map(([k, v]) => [k, v.value]),
      ) as Record<string, string | number>;
      const newAddr = encodePrefixByValue(catalog, prefixId, latest, values);

      return {
        address: `${prefixId}:${latest}:${newAddr}`,
        values,
        migrated: true,
      };
    },

    serviceAddress: getServiceAddr,

    track(prefixes: Record<string, Record<string, string | number>>) {
      const address_context: Record<string, string> = {};
      const addresses: Record<string, { prefix: string; version: string; address: number }> = {};

      for (const [prefixId, dims] of Object.entries(prefixes)) {
        const serialized = this.encode(prefixId, dims);
        address_context[prefixId] = serialized;

        const [p, v, a] = serialized.split(":");
        addresses[prefixId] = { prefix: p, version: v, address: Number(a) };
      }

      // service context는 항상 포함
      const svcAddr = getServiceAddr();
      const svcDef = catalog.prefixes.service;
      const svcVer = svcDef.versions[svcDef.versions.length - 1].version;
      if (!address_context.service) {
        address_context.service = `service:${svcVer}:${svcAddr}`;
        addresses.service = { prefix: "service", version: svcVer, address: svcAddr };
      }

      return { address_context, addresses };
    },

    readContext(address_context: Record<string, string>) {
      const result: Record<string, Record<string, string | number>> = {};
      for (const [prefixId, serialized] of Object.entries(address_context)) {
        result[prefixId] = this.decode(serialized);
      }
      return result;
    },

    executionMode: userConfig?.executionMode ?? "live",
    executionId: userConfig?.executionId,

    useDsl(dslId: string, memberPrefixes: readonly string[]): DslSession {
      const members = new Set(memberPrefixes);
      const self = this;

      return {
        dslId,
        memberPrefixes,

        track(prefixes: Record<string, Record<string, string | number>>) {
          const warnings: string[] = [];

          // 비멤버 prefix 사용 경고
          for (const prefixId of Object.keys(prefixes)) {
            if (!members.has(prefixId)) {
              warnings.push(`${prefixId}는 ${dslId}의 멤버가 아닙니다. 무시됩니다.`);
            }
          }

          // 멤버만 필터하여 track
          const filtered: Record<string, Record<string, string | number>> = {};
          for (const [prefixId, dims] of Object.entries(prefixes)) {
            if (members.has(prefixId)) {
              filtered[prefixId] = dims;
            }
          }

          const result = self.track(filtered);

          // 누락 멤버 경고
          const tracked = new Set(Object.keys(filtered));
          for (const m of members) {
            if (!tracked.has(m) && m !== "service") {
              warnings.push(`${dslId} 멤버 ${m}이(가) track되지 않았습니다.`);
            }
          }

          return { address_context: result.address_context, warnings };
        },
      };
    },
  };
}
