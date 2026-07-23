// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@qa-sdk/core';
import type { EventSchemaRecord, EventSchemaStore } from '../../stores/event-schema-store.js';

export const EVENT_SCHEMA_STORE = 'EVENT_SCHEMA_STORE';

type EventSchemaPayload = {
  displayName?: string;
  description?: string;
  recordKind?: 'log' | 'span' | 'both';
  status?: 'active' | 'deprecated' | 'retired';
};

@Injectable()
export class EventSchemaService {
  constructor(@Inject(EVENT_SCHEMA_STORE) private readonly eventSchemaStore: EventSchemaStore) {}

  static fromStore(eventSchemaStore: EventSchemaStore) {
    return new EventSchemaService(eventSchemaStore);
  }

  list(catalogId: string, serviceId?: string) {
    return serviceId
      ? this.eventSchemaStore.listByService(catalogId, serviceId)
      : this.eventSchemaStore.list(catalogId);
  }

  async listVersions(catalogId: string, serviceId: string, eventKey: string) {
    const records = await this.eventSchemaStore.listByService(catalogId, serviceId);
    const versions = records.filter((record) => record.eventKey === eventKey);
    if (versions.length === 0) {
      throw new AppError('NOT_FOUND', `Event '${serviceId}/${eventKey}' not found`, 404);
    }

    return {
      serviceId,
      eventKey,
      versions,
    };
  }

  async get(catalogId: string, serviceId: string, eventKey: string, eventVersion: string) {
    const record = await this.eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);
    if (!record) {
      throw new AppError('NOT_FOUND', 'Event schema not found', 404);
    }

    return record;
  }

  async upsert(
    catalogId: string,
    serviceId: string,
    eventKey: string,
    eventVersion: string,
    input: unknown,
  ) {
    const body = this.asPayload(input);
    const existing = await this.eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);
    const now = new Date().toISOString();

    const record: EventSchemaRecord = {
      catalogId,
      serviceId,
      eventKey,
      eventVersion,
      displayName: body.displayName ?? existing?.displayName ?? eventKey,
      description: body.description ?? existing?.description,
      recordKind: body.recordKind ?? existing?.recordKind ?? 'log',
      status: body.status ?? existing?.status ?? 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.eventSchemaStore.upsert(record);
    return {
      ok: true,
      action: existing ? 'updated' : 'created',
    };
  }

  async remove(catalogId: string, serviceId: string, eventKey: string, eventVersion: string) {
    const existing = await this.eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Event schema not found', 404);
    }

    await this.eventSchemaStore.delete(catalogId, serviceId, eventKey, eventVersion);
    return { ok: true };
  }

  private asPayload(input: unknown): EventSchemaPayload {
    if (!input || typeof input !== 'object') {
      return {};
    }

    return input as EventSchemaPayload;
  }
}
