// @def.boundary registry-system
// @def.doc registry-system

import type { EventSchemaRecord, EventSchemaStore } from "./event-schema-store.js";

export class InMemoryEventSchemaStore implements EventSchemaStore {
  private data = new Map<string, EventSchemaRecord>();

  private key(catalogId: string, serviceId: string, eventKey: string, eventVersion: string): string {
    return `${catalogId}:${serviceId}:${eventKey}:${eventVersion}`;
  }

  async upsert(record: EventSchemaRecord): Promise<void> {
    this.data.set(this.key(record.catalogId, record.serviceId, record.eventKey, record.eventVersion), record);
  }

  async get(catalogId: string, serviceId: string, eventKey: string, eventVersion: string): Promise<EventSchemaRecord | null> {
    return this.data.get(this.key(catalogId, serviceId, eventKey, eventVersion)) ?? null;
  }

  async listByService(catalogId: string, serviceId: string): Promise<EventSchemaRecord[]> {
    return [...this.data.values()].filter(r => r.catalogId === catalogId && r.serviceId === serviceId);
  }

  async list(catalogId: string): Promise<EventSchemaRecord[]> {
    return [...this.data.values()].filter(r => r.catalogId === catalogId);
  }

  async delete(catalogId: string, serviceId: string, eventKey: string, eventVersion: string): Promise<boolean> {
    return this.data.delete(this.key(catalogId, serviceId, eventKey, eventVersion));
  }
}
