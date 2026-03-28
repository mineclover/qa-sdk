import { Inject, Injectable } from "@nestjs/common";
import type { EventSchemaRecord, EventSchemaStore } from "../../stores/event-schema-store.js";
import { EventHttpError } from "./event-http-error.js";

export const EVENT_SCHEMA_STORE = "EVENT_SCHEMA_STORE";

type EventSchemaPayload = {
  displayName?: string;
  description?: string;
  recordKind?: "log" | "span" | "both";
  status?: "active" | "deprecated" | "retired";
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
      throw new EventHttpError(404, { error: `Event '${serviceId}/${eventKey}' not found` });
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
      throw new EventHttpError(404, { error: "Event schema not found" });
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
      recordKind: body.recordKind ?? existing?.recordKind ?? "log",
      status: body.status ?? existing?.status ?? "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.eventSchemaStore.upsert(record);
    return {
      ok: true,
      action: existing ? "updated" : "created",
    };
  }

  async remove(catalogId: string, serviceId: string, eventKey: string, eventVersion: string) {
    const existing = await this.eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);
    if (!existing) {
      throw new EventHttpError(404, { error: "Event schema not found" });
    }

    await this.eventSchemaStore.delete(catalogId, serviceId, eventKey, eventVersion);
    return { ok: true };
  }

  async validateLegacyRoute(catalogId: string, rawName: string, eventKey: string, eventVersion: string) {
    const serviceId = rawName.includes("/") ? rawName.split("/").pop()! : rawName;
    const record = await this.eventSchemaStore.get(catalogId, serviceId, eventKey, eventVersion);
    if (!record) {
      throw new EventHttpError(404, { error: "Event not found" });
    }

    return record;
  }

  private asPayload(input: unknown): EventSchemaPayload {
    if (!input || typeof input !== "object") {
      return {};
    }

    return input as EventSchemaPayload;
  }
}
