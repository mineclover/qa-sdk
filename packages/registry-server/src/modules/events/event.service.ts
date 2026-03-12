import { EventRepository } from "./event.repository.js";
import { ServiceRepository } from "../services/service.repository.js";
import type { CreateEventInput, UpdateEventInput } from "./event.schema.js";
import type {
  ServiceEvent,
  EventVersionList,
  EventWithServiceName,
} from "./event.types.js";
import { newEventId } from "../../lib/id.js";
import { bumpVersion } from "../../lib/version.js";
import { notFound } from "../../lib/errors.js";
import type { Db } from "../../db/client.js";

export class EventService {
  constructor(
    private eventRepo: EventRepository,
    private serviceRepo: ServiceRepository,
    private db: Db,
  ) {}

  async create(serviceId: string, input: CreateEventInput): Promise<ServiceEvent> {
    const service = await this.serviceRepo.findById(serviceId);
    if (!service) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceId}' not found`);
    }

    // advisory lock + version calculation in transaction
    const result = await this.db.transaction(async (tx) => {
      const txEventRepo = new EventRepository(tx as unknown as Db);

      await txEventRepo.acquireAdvisoryLock(serviceId, input.event_key);

      const latestVersion = await txEventRepo.getLatestVersion(
        serviceId,
        input.event_key,
      );

      const eventVersion = bumpVersion(latestVersion, input.bump);

      const row = await txEventRepo.insert({
        eventId: newEventId(),
        serviceId,
        eventKey: input.event_key,
        eventVersion,
        displayName: input.display_name,
        description: input.description ?? null,
        recordKind: input.record_kind,
      });

      return row;
    });

    return toEvent(result);
  }

  async getVersions(
    serviceName: string,
    eventKey: string,
  ): Promise<EventVersionList> {
    const service = await this.serviceRepo.findByName(serviceName);
    if (!service) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceName}' not found`);
    }

    const rows = await this.eventRepo.listVersions(service.serviceId, eventKey);
    if (rows.length === 0) {
      throw notFound("EVENT_NOT_FOUND", `event '${eventKey}' not found in service '${serviceName}'`);
    }

    return {
      service_name: serviceName,
      event_key: eventKey,
      versions: rows.map((r) => ({
        event_id: r.eventId,
        event_version: r.eventVersion,
        display_name: r.displayName,
        record_kind: r.recordKind,
        status: r.status,
      })),
    };
  }

  async getByVersion(
    serviceName: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<EventWithServiceName> {
    const service = await this.serviceRepo.findByName(serviceName);
    if (!service) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceName}' not found`);
    }

    const row = await this.eventRepo.findByVersion(
      service.serviceId,
      eventKey,
      eventVersion,
    );
    if (!row) {
      throw notFound(
        "EVENT_NOT_FOUND",
        `event '${eventKey}' version '${eventVersion}' not found`,
      );
    }

    return { ...toEvent(row), service_name: serviceName };
  }

  async update(eventId: string, input: UpdateEventInput): Promise<ServiceEvent> {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw notFound("EVENT_NOT_FOUND", `event '${eventId}' not found`);
    }

    const row = await this.eventRepo.update(eventId, {
      ...(input.display_name !== undefined && { displayName: input.display_name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
    });

    return toEvent(row);
  }
}

function toEvent(row: any): ServiceEvent {
  return {
    event_id: row.eventId,
    service_id: row.serviceId,
    event_key: row.eventKey,
    event_version: row.eventVersion,
    display_name: row.displayName,
    description: row.description,
    record_kind: row.recordKind,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
