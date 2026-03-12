import { ServiceRepository } from "./service.repository.js";
import type { CreateServiceInput, UpdateServiceInput } from "./service.schema.js";
import type { Service } from "./service.types.js";
import { newServiceId } from "../../lib/id.js";
import { AppError, conflict, notFound } from "../../lib/errors.js";

export class ServiceService {
  constructor(private repo: ServiceRepository) {}

  async create(input: CreateServiceInput): Promise<Service> {
    const existing = await this.repo.findByName(input.service_name);
    if (existing) {
      throw conflict("SERVICE_NAME_CONFLICT", `service_name '${input.service_name}' already exists`);
    }

    const row = await this.repo.insert({
      serviceId: newServiceId(),
      serviceName: input.service_name,
      displayName: input.display_name,
      description: input.description ?? null,
    });

    return toService(row);
  }

  async getByName(serviceName: string): Promise<Service> {
    const row = await this.repo.findByName(serviceName);
    if (!row) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceName}' not found`);
    }
    return toService(row);
  }

  async getById(serviceId: string): Promise<Service> {
    const row = await this.repo.findById(serviceId);
    if (!row) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceId}' not found`);
    }
    return toService(row);
  }

  async update(serviceId: string, input: UpdateServiceInput): Promise<Service> {
    const existing = await this.repo.findById(serviceId);
    if (!existing) {
      throw notFound("SERVICE_NOT_FOUND", `service '${serviceId}' not found`);
    }

    const row = await this.repo.update(serviceId, {
      ...(input.display_name !== undefined && { displayName: input.display_name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
    });

    return toService(row);
  }
}

function toService(row: any): Service {
  return {
    service_id: row.serviceId,
    service_name: row.serviceName,
    display_name: row.displayName,
    description: row.description,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
