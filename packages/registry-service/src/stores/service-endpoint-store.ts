/**
 * ServiceEndpointStore — 좌표계 기반 서비스 URL 관리.
 *
 * composite key: (catalogId, namespace, svcName, env, region)
 * = service prefix 4축과 정확히 일치.
 *
 * ServiceBootConfig → 좌표 → DB lookup → URL resolve.
 */

/**
 * 서비스 엔드포인트 — 순수 URL 매핑.
 * tier/team 등 메타데이터는 ServiceRecord(토폴로지)에서 관리.
 */
export interface ServiceEndpointRecord {
  readonly catalogId: string;
  readonly namespace: string;
  readonly svcName: string;
  readonly env: string;
  readonly region: string;
  readonly url: string;
  readonly updatedAt: string;
}

export interface ServiceEndpointStore {
  upsert(record: ServiceEndpointRecord): Promise<void>;
  get(catalogId: string, namespace: string, svcName: string, env: string, region: string): Promise<ServiceEndpointRecord | null>;
  listByService(catalogId: string, namespace: string, svcName: string): Promise<ServiceEndpointRecord[]>;
  list(catalogId: string): Promise<ServiceEndpointRecord[]>;
  delete(catalogId: string, namespace: string, svcName: string, env: string, region: string): Promise<void>;
}
