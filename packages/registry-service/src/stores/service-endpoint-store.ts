/**
 * ServiceEndpointStore — 좌표계 기반 서비스 URL 관리.
 *
 * composite key: (catalogId, namespace, svcName, env, region)
 * = service prefix 4축과 정확히 일치.
 *
 * ServiceBootConfig → 좌표 → DB lookup → URL resolve.
 */

export interface ServiceEndpointRecord {
  readonly catalogId: string;
  readonly namespace: string;
  readonly svcName: string;
  readonly env: string;
  readonly region: string;
  readonly url: string;
  readonly tier?: string;
  readonly team?: string;
  readonly updatedAt: string;
}

export interface ServiceEndpointStore {
  upsert(record: ServiceEndpointRecord): Promise<void>;
  get(catalogId: string, namespace: string, svcName: string, env: string, region: string): Promise<ServiceEndpointRecord | null>;
  listByService(catalogId: string, namespace: string, svcName: string): Promise<ServiceEndpointRecord[]>;
  list(catalogId: string): Promise<ServiceEndpointRecord[]>;
  delete(catalogId: string, namespace: string, svcName: string, env: string, region: string): Promise<void>;
}
