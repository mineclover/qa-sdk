import type { ServiceEndpointRecord, ServiceEndpointStore } from "./service-endpoint-store.js";

export class InMemoryServiceEndpointStore implements ServiceEndpointStore {
  private readonly store = new Map<string, ServiceEndpointRecord>();

  private key(catalogId: string, ns: string, svc: string, env: string, region: string): string {
    return `${catalogId}:${ns}:${svc}:${env}:${region}`;
  }

  async upsert(record: ServiceEndpointRecord): Promise<void> {
    this.store.set(this.key(record.catalogId, record.namespace, record.svcName, record.env, record.region), record);
  }

  async get(catalogId: string, ns: string, svc: string, env: string, region: string): Promise<ServiceEndpointRecord | null> {
    return this.store.get(this.key(catalogId, ns, svc, env, region)) ?? null;
  }

  async listByService(catalogId: string, ns: string, svc: string): Promise<ServiceEndpointRecord[]> {
    return [...this.store.values()].filter(
      r => r.catalogId === catalogId && r.namespace === ns && r.svcName === svc,
    );
  }

  async list(catalogId: string): Promise<ServiceEndpointRecord[]> {
    return [...this.store.values()].filter(r => r.catalogId === catalogId);
  }

  async delete(catalogId: string, ns: string, svc: string, env: string, region: string): Promise<void> {
    this.store.delete(this.key(catalogId, ns, svc, env, region));
  }
}
