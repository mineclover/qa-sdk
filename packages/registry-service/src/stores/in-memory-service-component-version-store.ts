import type { ComponentVersionKind } from "../modules/services/service.types.js";
import type {
  ServiceComponentVersionRecord,
  ServiceComponentVersionStore,
} from "./service-component-version-store.js";

export class InMemoryServiceComponentVersionStore implements ServiceComponentVersionStore {
  private readonly store = new Map<string, ServiceComponentVersionRecord>();

  private key(catalogId: string, kind: ComponentVersionKind, serviceId: string, version: string): string {
    return `${catalogId}:${kind}:${serviceId}:${version}`;
  }

  async upsert(record: ServiceComponentVersionRecord): Promise<void> {
    this.store.set(
      this.key(record.catalogId, record.kind, record.serviceId, record.version),
      record,
    );
  }

  async get(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
    version: string,
  ): Promise<ServiceComponentVersionRecord | null> {
    return this.store.get(this.key(catalogId, kind, serviceId, version)) ?? null;
  }

  async listVersions(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
  ): Promise<ServiceComponentVersionRecord[]> {
    return [...this.store.values()]
      .filter(record =>
        record.catalogId === catalogId
        && record.kind === kind
        && record.serviceId === serviceId,
      )
      .sort((a, b) => a.version.localeCompare(b.version));
  }
}
