// @def.boundary infra-engine-system
// @def.doc infra-engine-system

/**
 * Definition-service HTTP 어댑터
 *
 * definition-service(localhost:3700)에서 서비스별 문서/테스트/prefix 정보를 조회한다.
 * @qa-sdk/definition-client에 의존하지 않고 순수 fetch 기반으로 구현하여
 * infra-engine의 범용성을 유지한다.
 */

export interface ServiceDocsInfo {
  serviceId: string;
  totalDocs: number;
  /** lifecycle별 문서 수 (예: { implemented: 5, approved: 3, draft: 1 }) */
  byLifecycle: Record<string, number>;
  /** layer별 문서 수 (예: { domain: 3, operation: 2, mediation: 4 }) */
  byLayer: Record<string, number>;
  docs: Array<{
    docId: string;
    title: string;
    lifecycle: string;
    layer: string;
    scope: string;
  }>;
}

export interface ServiceTestInfo {
  serviceId: string;
  totalTests: number;
  /** 0-100 범위의 통과율 */
  passRate: number;
  /** "pass": 전체 통과, "fail": 실패 존재, "no-data": 테스트 데이터 없음 */
  healthy: "pass" | "fail" | "no-data";
}

export interface ServicePrefixInfo {
  prefixId: string;
  name: string;
  category: string;
  labels: string[];
  description: string;
}

export interface DefinitionAdapter {
  /** 서비스에 속한 문서 요약 조회 */
  getServiceDocs(serviceId: string): Promise<ServiceDocsInfo>;

  /** 서비스 관련 테스트 건강도 조회 */
  getServiceTestHealth(serviceId: string): Promise<ServiceTestInfo>;

  /** prefix 상세 조회 */
  getPrefixInfo(prefixId: string): Promise<ServicePrefixInfo | null>;

  /** 서비스가 소유한 prefix들의 상세 조회 */
  getOwnedPrefixDetails(prefixIds: string[]): Promise<ServicePrefixInfo[]>;
}

export function createDefinitionAdapter(baseUrl: string): DefinitionAdapter {
  async function fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`definition-service 조회 실패 (${res.status}): ${path}`);
    return res.json() as Promise<T>;
  }

  const adapter: DefinitionAdapter = {
    async getServiceDocs(serviceId) {
      const data = await fetchJson<{ docs: any[]; total: number }>(
        `/docs?svc=${serviceId}&limit=200`,
      );
      const byLifecycle: Record<string, number> = {};
      const byLayer: Record<string, number> = {};
      for (const doc of data.docs) {
        const lc = (doc.lifecycle as string) ?? "unknown";
        const ly = (doc.layer as string) ?? "unknown";
        byLifecycle[lc] = (byLifecycle[lc] ?? 0) + 1;
        byLayer[ly] = (byLayer[ly] ?? 0) + 1;
      }
      return {
        serviceId,
        totalDocs: data.total,
        byLifecycle,
        byLayer,
        docs: data.docs.map((d: any) => ({
          docId: d.docId as string,
          title: (d.title as string) ?? (d.docId as string),
          lifecycle: (d.lifecycle as string) ?? "unknown",
          layer: (d.layer as string) ?? "unknown",
          scope: (d.scope as string) ?? "unknown",
        })),
      };
    },

    async getServiceTestHealth(serviceId) {
      // 서비스 문서 조회 후 테스트 상태 집계
      const docsData = await fetchJson<{ docs: any[] }>(`/docs?svc=${serviceId}&limit=200`);
      let totalPassed = 0;
      let totalFailed = 0;
      let totalTests = 0;

      // 과도한 요청 방지를 위해 최대 10건만 조회
      const docsToCheck = docsData.docs.slice(0, 10);
      for (const doc of docsToCheck) {
        try {
          const status = await fetchJson<{
            passed: number;
            failed: number;
            healthy: boolean;
          }>(`/tests/${doc.docId}/status`);
          totalPassed += status.passed ?? 0;
          totalFailed += status.failed ?? 0;
          totalTests += (status.passed ?? 0) + (status.failed ?? 0);
        } catch {
          // doc에 테스트가 없으면 무시
        }
      }

      const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
      const healthy: "pass" | "fail" | "no-data" =
        totalTests === 0 ? "no-data" : totalFailed === 0 ? "pass" : "fail";
      return {
        serviceId,
        totalTests,
        passRate,
        healthy,
      };
    },

    async getPrefixInfo(prefixId) {
      try {
        const data = await fetchJson<any>(`/prefixes/${prefixId}`);
        return {
          prefixId: data.prefixId as string,
          name: (data.name as string) ?? prefixId,
          category: (data.category as string) ?? "unknown",
          labels: (data.labels as string[]) ?? [],
          description: (data.description as string) ?? "",
        };
      } catch {
        return null;
      }
    },

    async getOwnedPrefixDetails(prefixIds) {
      const results: ServicePrefixInfo[] = [];
      for (const id of prefixIds) {
        const info = await adapter.getPrefixInfo(id);
        if (info) results.push(info);
      }
      return results;
    },
  };

  return adapter;
}
