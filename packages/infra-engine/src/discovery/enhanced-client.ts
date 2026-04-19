// @def.boundary infra-engine-system
// @def.doc infra-engine-system

/**
 * 확장 디스커버리 클라이언트
 *
 * 기본 DiscoveryClient(registry-service)에 definition-service 데이터를 통합하여
 * 서비스별 문서/테스트/prefix 상세를 함께 제공한다.
 */

import type { DiscoveryClient, ServiceInfo } from "./client.js";
import type {
  DefinitionAdapter,
  ServiceDocsInfo,
  ServiceTestInfo,
  ServicePrefixInfo,
} from "../adapters/definition.js";

export interface EnhancedServiceInfo extends ServiceInfo {
  docs?: ServiceDocsInfo;
  testHealth?: ServiceTestInfo;
  ownedPrefixDetails?: ServicePrefixInfo[];
}

export interface EnhancedDiscoveryClient extends DiscoveryClient {
  /** 서비스 조회 + definition 문서/테스트/prefix 정보 통합 */
  resolveEnhanced(serviceId: string, env?: string): Promise<EnhancedServiceInfo | null>;

  /** 서비스별 문서 요약 */
  getServiceDocs(serviceId: string): Promise<ServiceDocsInfo>;

  /** 서비스별 테스트 건강도 */
  getServiceTestHealth(serviceId: string): Promise<ServiceTestInfo>;
}

export function createEnhancedDiscoveryClient(
  baseClient: DiscoveryClient,
  definition: DefinitionAdapter,
): EnhancedDiscoveryClient {
  return {
    // 기본 DiscoveryClient 메서드 위임
    resolve: baseClient.resolve.bind(baseClient),
    resolveAll: baseClient.resolveAll.bind(baseClient),
    listServices: baseClient.listServices.bind(baseClient),
    generateConnectCode: baseClient.generateConnectCode.bind(baseClient),
    generateConnectCodeAll: baseClient.generateConnectCodeAll.bind(baseClient),

    async resolveEnhanced(serviceId, env) {
      const base = await baseClient.resolve(serviceId, env);
      if (!base) return null;

      // definition-service 데이터 통합 (fail-open: 각각 독립 실패 허용)
      let docs: ServiceDocsInfo | undefined;
      let testHealth: ServiceTestInfo | undefined;
      let ownedPrefixDetails: ServicePrefixInfo[] | undefined;

      try {
        docs = await definition.getServiceDocs(serviceId);
      } catch {
        /* fail-open */
      }
      try {
        testHealth = await definition.getServiceTestHealth(serviceId);
      } catch {
        /* fail-open */
      }
      try {
        if (base.ownedPrefixes.length > 0) {
          ownedPrefixDetails = await definition.getOwnedPrefixDetails(base.ownedPrefixes);
        }
      } catch {
        /* fail-open */
      }

      return { ...base, docs, testHealth, ownedPrefixDetails };
    },

    async getServiceDocs(serviceId) {
      return definition.getServiceDocs(serviceId);
    },

    async getServiceTestHealth(serviceId) {
      return definition.getServiceTestHealth(serviceId);
    },
  };
}
