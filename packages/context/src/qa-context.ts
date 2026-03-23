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

import type { Catalog, ServiceBootConfig, PrefixIds } from "@qa-sdk/core";
import {
  parseSerializedAddress,
  encodePrefixByValue,
  decodePrefixAsResult,
  decodeResultToEntities,
  latestPrefixVersion,
} from "@qa-sdk/core";

/** 실행 모드 */
export type ExecutionMode = "live" | "test" | "synthetic" | "replay";

export interface QaContextConfig<C extends Catalog = Catalog> {
  /** 통합 서비스 설정. 개별 필드(env/region/service/namespace)보다 우선. */
  serviceConfig?: ServiceBootConfig;
  /** @deprecated serviceConfig.env 사용 */
  env?: string;
  /** @deprecated serviceConfig.region 사용 */
  region?: string;
  /** @deprecated serviceConfig.name 사용 */
  service?: string;
  /** @deprecated serviceConfig.namespace 사용 */
  namespace?: string;
  /** 카탈로그. 정적 타입이면 prefix 자동완성 제공. */
  catalog?: C;
  /**
   * Registry URL. 설정하면 registry에서 active catalog을 가져옴.
   * 미설정 시 catalog 옵션 또는 DEMO_CATALOG 사용.
   * (default: process.env.QA_REGISTRY_URL)
   */
  registry?: string;
  /** 실행 모드 (default: "live") */
  executionMode?: ExecutionMode;
  /** 실행 식별자 — 테스트 suite ID 등 */
  executionId?: string;
  /**
   * codegen GENERATION 상수. 설정하면 catalog content hash와 비교하여 불일치 시 경고.
   * 형식: "catalogId:contentHash" (예: "demo:abb55ca63a8b")
   */
  generation?: string;
}

/** DSL 세션 — useDsl() 반환값 */
export interface DslSession {
  /** DSL 번들 ID */
  readonly dslId: string;
  /** DSL 멤버 prefix 목록 */
  readonly memberPrefixes: readonly string[];
  /** track — DSL 멤버만 허용, 누락 경고 포함 */
  track(prefixes: Partial<Record<string, Record<string, string | number>>>): {
    address_context: Record<string, string>;
    warnings: readonly string[];
  };
}

export interface QaContext<P extends string = string> {
  /** 환경 설정 */
  readonly config: Readonly<Required<Pick<QaContextConfig, "env" | "region" | "service" | "namespace">>>;

  /** 인코딩: 비즈니스 차원만 지정 → prefix:version:address. 정적 카탈로그 사용 시 prefix 자동완성. */
  encode(prefix: P, dims: Record<string, string | number>, version?: string): string;

  /** 디코딩: prefix:version:address → 문자열 값 */
  decode(serialized: string): Record<string, string | number>;

  /** 자동 마이그레이션: 구버전 → 최신 */
  resolve(serialized: string): { address: string; values: Record<string, string | number>; migrated: boolean };

  /** 서비스 주소 (현재 env/region/service/namespace의 정수 주소) */
  serviceAddress(): number;

  /** 서비스 주소를 infra_context 형태로 반환. QaLogger.infraContext에 직접 전달 가능. */
  infraContext(): Record<string, string>;

  /**
   * 이벤트 추적 — encode + address_context 자동 생성.
   *
   * 여러 prefix를 한번에 태깅할 수 있다.
   * 반환된 address_context를 QaLogger.log()에 전달하면 된다.
   */
  track(prefixes: Partial<Record<P, Record<string, string | number>>>): {
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

export function createQaContext<C extends Catalog = Catalog>(userConfig?: QaContextConfig<C>): QaContext<PrefixIds<C>> {
  const svc = userConfig?.serviceConfig;
  const config = {
    env: svc?.env ?? userConfig?.env ?? process.env.QA_ENV ?? "dev",
    region: svc?.region ?? userConfig?.region ?? process.env.QA_REGION ?? "",
    service: svc?.name ?? userConfig?.service ?? process.env.QA_SERVICE ?? "",
    namespace: svc?.namespace ?? userConfig?.namespace ?? process.env.QA_NAMESPACE ?? "default",
  };

  if (!config.region) {
    throw new Error('QaContext: "region" is required. Set via serviceConfig, QaContextConfig, or QA_REGION env.');
  }
  if (!config.service) {
    throw new Error('QaContext: "service" is required. Set via serviceConfig, QaContextConfig, or QA_SERVICE env.');
  }

  if (!userConfig?.catalog) {
    throw new Error("catalog is required. Pass catalog in QaContextConfig.");
  }
  const catalog: Catalog = userConfig.catalog;

  // generation 검증 (fail-open)
  if (userConfig.generation) {
    const [genCatalogId, genHash] = userConfig.generation.split(":");
    if (genCatalogId && genCatalogId !== catalog.id) {
      console.warn(`[QaContext] GENERATION catalog "${genCatalogId}" ≠ loaded catalog "${catalog.id}". 생성된 타입이 다른 카탈로그 기준일 수 있습니다.`);
    }
    // content hash 검증은 runtime에서 hash 재계산 비용이 크므로 catalogId만 검증
    // 정밀 검증이 필요하면 registry API에서 확인
  }

  // 서비스 주소 캐시
  let _svcAddr: number | null = null;

  const getServiceAddr = (): number => {
    if (_svcAddr !== null) return _svcAddr;
    _svcAddr = encodePrefixByValue(catalog, "service", latestPrefixVersion(catalog, "service"), {
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
      const prefixDef = catalog.prefixes[prefix];
      if (!prefixDef) throw new Error(`Unknown prefix: ${prefix}`);
      const ver = version ?? latestPrefixVersion(catalog, prefix);

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
      const { prefix: prefixId, version, address } = parseSerializedAddress(serialized);
      const result = decodePrefixAsResult(catalog, prefixId, version, address);
      return decodeResultToEntities(result);
    },

    resolve(serialized: string) {
      const { prefix: prefixId, version, address } = parseSerializedAddress(serialized);
      const prefixDef = catalog.prefixes[prefixId as keyof typeof catalog.prefixes];
      if (!prefixDef) throw new Error(`Unknown prefix: ${prefixId}`);
      const latest = latestPrefixVersion(catalog, prefixId);

      if (version === latest) {
        const result = decodePrefixAsResult(catalog, prefixId, version, address);
        return {
          address: serialized,
          values: decodeResultToEntities(result),
          migrated: false,
        };
      }

      // 구버전 → decode → re-encode
      const result = decodePrefixAsResult(catalog, prefixId, version, address);
      const values = decodeResultToEntities(result) as Record<string, string | number>;
      const newAddr = encodePrefixByValue(catalog, prefixId, latest, values);

      return {
        address: `${prefixId}:${latest}:${newAddr}`,
        values,
        migrated: true,
      };
    },

    serviceAddress: getServiceAddr,

    infraContext() {
      const svcAddr = getServiceAddr();
      const svcVer = latestPrefixVersion(catalog, "service");
      return { service: `service:${svcVer}:${svcAddr}` };
    },

    track(prefixes) {
      const address_context: Record<string, string> = {};
      const addresses: Record<string, { prefix: string; version: string; address: number }> = {};

      for (const [prefixId, dims] of Object.entries(prefixes)) {
        if (!dims) continue;
        const serialized = this.encode(prefixId as PrefixIds<C>, dims);
        address_context[prefixId] = serialized;

        const parsed = parseSerializedAddress(serialized);
        addresses[prefixId] = { prefix: parsed.prefix, version: parsed.version, address: parsed.address };
      }

      // service context는 항상 포함
      const svcAddr = getServiceAddr();
      const svcVer = latestPrefixVersion(catalog, "service");
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

        track(prefixes) {
          const warnings: string[] = [];

          // 비멤버 prefix 사용 경고
          for (const prefixId of Object.keys(prefixes)) {
            if (!members.has(prefixId)) {
              warnings.push(`${prefixId}는 ${dslId}의 멤버가 아닙니다. 무시됩니다.`);
            }
          }

          // 멤버만 필터하여 track
          const filtered: Partial<Record<string, Record<string, string | number>>> = {};
          for (const [prefixId, dims] of Object.entries(prefixes)) {
            if (dims && members.has(prefixId)) {
              filtered[prefixId] = dims;
            }
          }

          const result = self.track(filtered as Partial<Record<PrefixIds<C>, Record<string, string | number>>>);

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

/**
 * 비동기 QaContext 생성 — registry에서 catalog을 가져올 때 사용.
 *
 * 컨벤션:
 *   - registry 옵션이 있으면 → registry에서 active catalog fetch
 *   - 없으면 → createQaContext()와 동일 (로컬)
 *   - SDK와 CLI 모두 이 경로를 통해 catalog을 소비
 *
 * 사용:
 *   const qa = await createQaContextAsync({ registry: "http://registry:3300" });
 */
export async function createQaContextAsync<C extends Catalog = Catalog>(userConfig?: QaContextConfig<C>): Promise<QaContext<PrefixIds<C>>> {
  const registryUrl = userConfig?.registry ?? process.env.QA_REGISTRY_URL;

  if (registryUrl) {
    try {
      const { createCatalogProvider } = await import("./catalog-provider.js");
      const provider = createCatalogProvider({ registry: registryUrl });
      const catalog = await provider.getCatalog();

      // generation 검증 — registry의 hash와 비교
      if (userConfig?.generation) {
        const [, genHash] = userConfig.generation.split(":");
        if (genHash) {
          try {
            const genRes = await fetch(`${registryUrl}/health/generation`);
            if (genRes.ok) {
              const genData = await genRes.json() as { generations: Record<string, { catalogHash: string }> };
              const catalogId = catalog.id ?? "demo";
              const registryHash = genData.generations?.[catalogId]?.catalogHash;
              if (registryHash && registryHash !== genHash) {
                console.warn(
                  `[QaContext] GENERATION hash "${genHash}" ≠ registry hash "${registryHash}". ` +
                  `codegen 재실행이 필요할 수 있습니다: qa-sdk codegen --registry ${registryUrl}`,
                );
              }
            }
          } catch { /* generation 검증 실패는 무시 (fail-open) */ }
        }
      }

      return createQaContext({ ...userConfig, catalog });
    } catch (err) {
      console.warn(`[QaContext] Registry fetch failed (${registryUrl}): ${err instanceof Error ? err.message : String(err)}. Falling back to local catalog.`);
    }
  }

  return createQaContext(userConfig);
}
