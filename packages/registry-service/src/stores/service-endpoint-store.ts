// @def.boundary registry-system
// @def.doc registry-system

/**
 * ServiceEndpointStore — 서비스 URL 관리.
 *
 * composite key: (catalogId, namespace, svcName, env, region)
 *
 * 비즈니스 서비스(svc_name 축에 등록)는 좌표계와 일치.
 * 인프라 서비스(registry, ingest 등)는 좌표계 외부이지만 동일 키 구조 사용.
 *
 * ServiceBootConfig → DB lookup → URL resolve.
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
