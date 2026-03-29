import { Inject, Injectable } from "@nestjs/common";
import { AppError } from "@qa-sdk/core";
import type { ServiceEndpointStore } from "../../stores/service-endpoint-store.js";
import { SERVICE_ENDPOINT_STORE } from "./service-topology.service.js";

type EndpointPayload = {
  url?: string | null;
};

@Injectable()
export class EndpointService {
  constructor(
    @Inject(SERVICE_ENDPOINT_STORE) private readonly endpointStore: ServiceEndpointStore,
  ) {}

  static fromStore(endpointStore: ServiceEndpointStore) {
    return new EndpointService(endpointStore);
  }

  list(catalogId: string) {
    return this.endpointStore.list(catalogId);
  }

  async resolve(
    catalogId: string,
    namespace?: string,
    name?: string,
    env?: string,
    region?: string,
  ) {
    if (!namespace || !name || !env || !region) {
      throw new AppError("INVALID_INPUT", "namespace, name, env, region 필수", 400);
    }

    const record = await this.endpointStore.get(catalogId, namespace, name, env, region);
    if (!record) {
      throw new AppError("NOT_FOUND", `Endpoint not found: ${namespace}/${name}@${env}.${region}`, 404);
    }

    return { url: record.url };
  }

  listByService(catalogId: string, namespace: string, serviceName: string) {
    return this.endpointStore.listByService(catalogId, namespace, serviceName);
  }

  async get(catalogId: string, namespace: string, serviceName: string, env: string, region: string) {
    const record = await this.endpointStore.get(catalogId, namespace, serviceName, env, region);
    if (!record) {
      throw new AppError("NOT_FOUND", "Endpoint not found", 404);
    }

    return record;
  }

  async upsert(
    catalogId: string,
    namespace: string,
    serviceName: string,
    env: string,
    region: string,
    input: unknown,
  ) {
    const body = this.asPayload(input);
    if (!body.url) {
      throw new AppError("INVALID_INPUT", "url 필수", 400);
    }

    await this.endpointStore.upsert({
      catalogId,
      namespace,
      svcName: serviceName,
      env,
      region,
      url: body.url,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  async remove(catalogId: string, namespace: string, serviceName: string, env: string, region: string) {
    await this.endpointStore.delete(catalogId, namespace, serviceName, env, region);
    return { ok: true };
  }

  private asPayload(input: unknown): EndpointPayload {
    if (!input || typeof input !== "object") {
      return {};
    }

    return input as EndpointPayload;
  }
}
