// @def.boundary registry-system
// @def.doc registry-system

import { AppError } from '@qa-sdk/core';
import type {
  ServiceComponentLifecycleState,
  ServiceComponentVersionRecord,
  ServiceComponentVersionStore,
} from '../../stores/service-component-version-store.js';
import type {
  ComponentVersionKind,
  DeploymentBinding,
  RuntimeServiceAddress,
  ServiceExposureSpec,
  ServiceOwnershipSpec,
  ServiceUnitSpec,
} from './service.types.js';

export type ServiceComponentValue =
  | ServiceUnitSpec
  | ServiceOwnershipSpec
  | ServiceExposureSpec
  | RuntimeServiceAddress
  | DeploymentBinding;

export interface ServiceComponentRecord<TValue = unknown> {
  readonly kind: ComponentVersionKind;
  readonly serviceId: string;
  readonly version: string;
  readonly state?: ServiceComponentLifecycleState;
  readonly value: TValue;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly publishedAt?: string;
  readonly deprecatedAt?: string;
  readonly archivedAt?: string;
}

export function isComponentVersionKind(value: string): value is ComponentVersionKind {
  return (
    value === 'service-unit' ||
    value === 'ownership' ||
    value === 'exposure' ||
    value === 'runtime-address' ||
    value === 'deployment-binding'
  );
}

export class ServiceComponentStore {
  constructor(private readonly store: ServiceComponentVersionStore) {}

  async upsert(catalogId: string, record: ServiceComponentRecord): Promise<void> {
    this.validateRecord(record);
    await this.store.upsert(toStoreRecord(catalogId, record));
  }

  async get(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
    version: string,
  ): Promise<ServiceComponentRecord | null> {
    const record = await this.store.get(catalogId, kind, serviceId, version);
    if (!record) return null;
    return parseStoreRecord(record);
  }

  async require(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
    version: string,
  ): Promise<ServiceComponentRecord> {
    const record = await this.get(catalogId, kind, serviceId, version);
    if (!record) {
      throw new AppError('NOT_FOUND', `Component not found: ${kind}/${serviceId}/${version}`, 404);
    }
    return record;
  }

  async listVersions(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
  ): Promise<ServiceComponentRecord[]> {
    const records = await this.store.listVersions(catalogId, kind, serviceId);
    return records
      .map(parseStoreRecord)
      .filter((record): record is ServiceComponentRecord => record != null);
  }

  private validateRecord(record: ServiceComponentRecord): void {
    if (!record.serviceId) {
      throw new AppError('INVALID_INPUT', 'serviceId 필수', 400);
    }
    if (!record.version) {
      throw new AppError('INVALID_INPUT', 'version 필수', 400);
    }
    if (record.value == null || typeof record.value !== 'object') {
      throw new AppError('INVALID_INPUT', 'value 객체 필수', 400);
    }

    const value = record.value as unknown as Record<string, unknown>;
    const embeddedServiceId = value['serviceId'];
    if (typeof embeddedServiceId === 'string' && embeddedServiceId !== record.serviceId) {
      throw new AppError(
        'INVALID_INPUT',
        `value.serviceId "${embeddedServiceId}" != component serviceId "${record.serviceId}"`,
        400,
      );
    }
  }
}

function toStoreRecord(
  catalogId: string,
  record: ServiceComponentRecord,
): ServiceComponentVersionRecord {
  return {
    catalogId,
    kind: record.kind,
    serviceId: record.serviceId,
    version: record.version,
    state: record.state ?? 'draft',
    valueJson: JSON.stringify(record.value),
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    publishedAt: record.publishedAt,
    deprecatedAt: record.deprecatedAt,
    archivedAt: record.archivedAt,
  };
}

function parseStoreRecord(record: ServiceComponentVersionRecord): ServiceComponentRecord | null {
  const value = JSON.parse(record.valueJson) as unknown;
  if (!isComponentVersionKind(record.kind) || value == null || typeof value !== 'object') {
    return null;
  }
  return {
    kind: record.kind,
    serviceId: record.serviceId,
    version: record.version,
    state: record.state,
    value,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    deprecatedAt: record.deprecatedAt,
    archivedAt: record.archivedAt,
  };
}
