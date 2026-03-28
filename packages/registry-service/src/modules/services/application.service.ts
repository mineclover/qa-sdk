import { Inject, Injectable } from "@nestjs/common";
import {
  SERVICE_CONFIG_STORE,
  ServiceModuleHttpError,
  ServiceTopologyService,
} from "./service-topology.service.js";
import type { ConfigStore } from "../../stores/config-store.js";
import type { ServiceRecord } from "./service.types.js";

const APPLICATIONS_CONFIG_TYPE = "applications";

export interface ApplicationRecord {
  readonly applicationId: string;
  readonly name: string;
  readonly description?: string;
  readonly serviceIds: readonly string[];
  readonly criticality?: "critical" | "high" | "medium" | "low";
  readonly owner?: {
    readonly team?: string;
    readonly developer?: string;
    readonly business?: string;
  };
}

type ApplicationListPayload = {
  applications?: unknown;
};

@Injectable()
export class ApplicationService {
  constructor(
    @Inject(SERVICE_CONFIG_STORE) private readonly configStore: ConfigStore,
    @Inject(ServiceTopologyService) private readonly serviceTopology: ServiceTopologyService,
  ) {}

  async list(catalogId: string) {
    const record = await this.configStore.get(catalogId, APPLICATIONS_CONFIG_TYPE);
    if (!record) {
      return [];
    }

    return this.parseApplications(record.data) ?? [];
  }

  async get(catalogId: string, applicationId: string) {
    const applications = await this.list(catalogId);
    const found = applications.find((application) => application.applicationId === applicationId);
    if (!found) {
      throw new ServiceModuleHttpError(404, { error: `Application '${applicationId}' not found` });
    }

    const services = await this.serviceTopology.list(catalogId);
    return {
      ...found,
      services: services.filter((service) => found.serviceIds.includes(service.serviceId)),
    };
  }

  async replaceAll(catalogId: string, input: unknown) {
    const body = this.asListPayload(input);
    const applications = Array.isArray(body.applications) ? body.applications as ApplicationRecord[] : null;
    if (!applications) {
      throw new ServiceModuleHttpError(400, { error: "applications 배열 필수" });
    }

    await this.configStore.set(catalogId, APPLICATIONS_CONFIG_TYPE, JSON.stringify(applications));
    return { ok: true, count: applications.length };
  }

  private parseApplications(data: string): ApplicationRecord[] | null {
    try {
      return JSON.parse(data) as ApplicationRecord[];
    } catch {
      return null;
    }
  }

  private asListPayload(input: unknown): ApplicationListPayload {
    if (!input || typeof input !== "object") {
      return {};
    }
    return input as ApplicationListPayload;
  }
}
