// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from "@nestjs/common";
import { AppError } from "@qa-sdk/core";
import type { ConfigStore } from "../../stores/config-store.js";
import type { ServiceEndpointStore } from "../../stores/service-endpoint-store.js";
import {
  SERVICE_CONFIG_STORE,
  SERVICE_ENDPOINT_STORE,
} from "./service-topology.service.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type HealthDetail = { readonly [key: string]: JsonValue };

export interface ServiceHealthResult {
  serviceId: string;
  url: string;
  status: "up" | "down" | "unknown";
  latencyMs: number;
  detail?: HealthDetail;
  error?: string;
}

interface ServiceRecord {
  serviceId: string;
  url?: string;
  urls?: Record<string, string>;
  tier?: string;
}

export const SERVICE_HEALTH_BINDINGS = "SERVICE_HEALTH_BINDINGS";

@Injectable()
export class ServiceHealthService {
  constructor(
    @Inject(SERVICE_CONFIG_STORE) private readonly configStore: ConfigStore,
    @Optional() @Inject(SERVICE_ENDPOINT_STORE) private readonly endpointStore?: ServiceEndpointStore,
    @Optional() @Inject(SERVICE_HEALTH_BINDINGS) private readonly serviceBindings?: Record<string, Fetcher>,
  ) {}

  async getSummary(query: {
    catalogId: string;
    envName: string;
    namespace: string;
    region: string;
  }) {
    const record = await this.configStore.get(query.catalogId, "services");
    if (!record) {
      throw new AppError("NOT_FOUND", "No services registered", 404);
    }

    let services: ServiceRecord[];
    try {
      services = JSON.parse(record.data) as ServiceRecord[];
    } catch {
      throw new AppError("INTERNAL_ERROR", "Invalid services data", 500);
    }

    const endpointUrls: Record<string, string> = {};
    if (this.endpointStore) {
      const endpoints = await this.endpointStore.list(query.catalogId);
      for (const endpoint of endpoints) {
        if (
          endpoint.env === query.envName
          && endpoint.region === query.region
          && endpoint.namespace === query.namespace
        ) {
          endpointUrls[endpoint.svcName] = endpoint.url;
        }
      }
    }

    const targets: Array<{ serviceId: string; url: string; tier?: string }> = [];
    for (const service of services) {
      const url = endpointUrls[service.serviceId] ?? service.urls?.[query.envName] ?? service.url;
      if (!url || url.includes("localhost")) {
        continue;
      }
      targets.push({ serviceId: service.serviceId, url, tier: service.tier });
    }

    const bindings = this.serviceBindings ?? {};
    const results = await Promise.all(
      targets.map((target) => {
        if (target.serviceId === "registry-service") {
          return Promise.resolve({
            serviceId: target.serviceId,
            url: target.url,
            status: "up" as const,
            latencyMs: 0,
            detail: { ok: true, self: true },
          });
        }

        return this.checkHealth(target.serviceId, target.url, bindings[target.serviceId]);
      }),
    );

    const up = results.filter((result) => result.status === "up").length;
    const down = results.filter((result) => result.status === "down").length;
    const total = results.length;
    const status = down === 0 ? "healthy" : up > 0 ? "degraded" : "unhealthy";

    return {
      status,
      total,
      up,
      down,
      checkedAt: new Date().toISOString(),
      env: query.envName,
      services: results.map((result) => Object.assign({}, result, {
        tier: targets.find((target) => target.serviceId === result.serviceId)?.tier,
      })),
    };
  }

  private async checkHealth(
    serviceId: string,
    baseUrl: string,
    binding?: Fetcher,
  ): Promise<ServiceHealthResult> {
    const start = Date.now();
    const url = baseUrl.replace(/\/$/, "");

    try {
      let response: Response;
      if (binding) {
        response = await binding.fetch(new Request("https://internal/health"));
      } else {
        response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5_000) });
      }

      const latencyMs = Date.now() - start;
      if (response.ok) {
        let detail: HealthDetail | undefined;
        try {
          detail = await response.json() as HealthDetail;
        } catch {
          detail = undefined;
        }

        return { serviceId, url, status: "up", latencyMs, detail };
      }

      return {
        serviceId,
        url,
        status: "down",
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        serviceId,
        url,
        status: "down",
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
