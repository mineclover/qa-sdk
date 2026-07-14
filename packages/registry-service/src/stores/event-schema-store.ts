// @def.boundary registry-system
// @def.doc registry-system

/** 이벤트 스키마 저장소 — 서비스별 이벤트 키/버전 관리 */

export interface EventSchemaRecord {
  readonly catalogId: string;
  readonly serviceId: string;
  readonly eventKey: string;
  readonly eventVersion: string;
  readonly displayName: string;
  readonly description?: string;
  readonly recordKind: 'log' | 'span' | 'both';
  readonly status: 'active' | 'deprecated' | 'retired';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EventSchemaStore {
  upsert(record: EventSchemaRecord): Promise<void>;
  get(
    catalogId: string,
    serviceId: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<EventSchemaRecord | null>;
  listByService(catalogId: string, serviceId: string): Promise<EventSchemaRecord[]>;
  list(catalogId: string): Promise<EventSchemaRecord[]>;
  delete(
    catalogId: string,
    serviceId: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<boolean>;
}
