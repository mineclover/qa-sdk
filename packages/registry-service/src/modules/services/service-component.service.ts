import { Inject, Injectable, Optional } from "@nestjs/common";
import { AppError } from "@qa-sdk/core";
import type {
  ServiceComponentLifecycleState,
  ServiceComponentVersionStore,
} from "../../stores/service-component-version-store.js";
import type { ComponentVersionKind, DeploymentBinding } from "./service.types.js";
import { ManifestService } from "../manifests/manifest.service.js";
import {
  isComponentVersionKind,
  ServiceComponentStore,
  type ServiceComponentRecord,
} from "./service-component-store.js";

export const SERVICE_COMPONENT_VERSION_STORE = "SERVICE_COMPONENT_VERSION_STORE";

@Injectable()
export class ServiceComponentService {
  private readonly store: ServiceComponentStore;

  constructor(
    @Inject(SERVICE_COMPONENT_VERSION_STORE) componentStore: ServiceComponentVersionStore,
    @Optional() @Inject(ManifestService) private readonly manifests?: ManifestService,
  ) {
    this.store = new ServiceComponentStore(componentStore);
  }

  static fromStore(componentStore: ServiceComponentVersionStore, manifests?: ManifestService) {
    return new ServiceComponentService(componentStore, manifests);
  }

  listVersions(catalogId: string, kind: string, serviceId: string) {
    return this.store.listVersions(catalogId, this.parseKind(kind), serviceId);
  }

  async listPublishedVersions(catalogId: string, kind: string, serviceId: string) {
    const versions = await this.listVersions(catalogId, kind, serviceId);
    return versions.filter(record => record.state === "published");
  }

  async getAssemblyCandidates(catalogId: string, serviceId: string) {
    const serviceUnit = await this.listVersions(catalogId, "service-unit", serviceId);
    const ownership = await this.listVersions(catalogId, "ownership", serviceId);
    const runtimeAddress = await this.listVersions(catalogId, "runtime-address", serviceId);
    const exposure = await this.listVersions(catalogId, "exposure", serviceId);
    const deploymentBinding = await this.listVersions(catalogId, "deployment-binding", serviceId);

    const required = {
      "service-unit": this.toCandidateBucket(serviceUnit, "required"),
      "ownership": this.toCandidateBucket(ownership, "required"),
      "runtime-address": this.toCandidateBucket(runtimeAddress, "required"),
    };
    const optional = {
      "exposure": this.toCandidateBucket(exposure, "optional"),
      "deployment-binding": this.toCandidateBucket(deploymentBinding, "optional"),
    };

    const missingRequired = Object.entries(required)
      .filter(([, bucket]) => bucket.published.length === 0)
      .map(([kind]) => kind);

    const allExcluded = [
      ...Object.values(required).flatMap(bucket => bucket.excluded),
      ...Object.values(optional).flatMap(bucket => bucket.excluded),
    ];

    return {
      serviceId,
      required,
      optional,
      readiness: {
        ready: missingRequired.length === 0,
        missingRequired,
      },
      summary: {
        published: {
          required: Object.values(required).reduce((sum, bucket) => sum + bucket.published.length, 0),
          optional: Object.values(optional).reduce((sum, bucket) => sum + bucket.published.length, 0),
        },
        excluded: {
          draft: allExcluded.filter(item => item.state === "draft").length,
          deprecated: allExcluded.filter(item => item.state === "deprecated").length,
          archived: allExcluded.filter(item => item.state === "archived").length,
        },
      },
    };
  }

  get(catalogId: string, kind: string, serviceId: string, version: string) {
    return this.store.require(catalogId, this.parseKind(kind), serviceId, version);
  }

  async syncDeployment(
    catalogId: string,
    serviceId: string,
    body: {
      deploymentVersion: string;
      runtime: {
        namespace: string;
        name: string;
        env: string;
        region: string;
      };
      provider: string;
      project: string;
      stack: string;
      resourceKey: string;
      url?: string;
      urn?: string;
      outputs?: Record<string, unknown>;
    },
  ) {
    if (!body.deploymentVersion) {
      throw new AppError("INVALID_INPUT", "deploymentVersion 필수", 400);
    }
    if (!body.runtime?.namespace || !body.runtime?.name || !body.runtime?.env || !body.runtime?.region) {
      throw new AppError("INVALID_INPUT", "runtime.namespace/name/env/region 필수", 400);
    }
    if (!body.provider || !body.project || !body.stack || !body.resourceKey) {
      throw new AppError("INVALID_INPUT", "provider/project/stack/resourceKey 필수", 400);
    }

    const value: DeploymentBinding = {
      deploymentVersion: body.deploymentVersion,
      address: {
        serviceId,
        runtime: {
          serviceId,
          namespace: body.runtime.namespace,
          name: body.runtime.name,
          env: body.runtime.env,
          region: body.runtime.region,
        },
        provider: body.provider,
        project: body.project,
        stack: body.stack,
        resourceKey: body.resourceKey,
      },
      observedAt: new Date().toISOString(),
      ...(body.url ? { url: body.url } : {}),
      ...(body.urn ? { urn: body.urn } : {}),
      ...(body.outputs ? { outputs: body.outputs } : {}),
    };

    const result = await this.upsert(
      catalogId,
      "deployment-binding",
      serviceId,
      body.deploymentVersion,
      value,
    );

    return {
      ...result,
      synced: true,
    };
  }

  async upsert(
    catalogId: string,
    kind: string,
    serviceId: string,
    version: string,
    value: unknown,
  ) {
    const existing = await this.store.get(catalogId, this.parseKind(kind), serviceId, version);
    if (existing && existing.state !== "draft") {
      throw new AppError(
        "INVALID_TRANSITION",
        `Only draft component can be updated: ${kind}/${serviceId}/${version}`,
        409,
      );
    }
    const record = {
      kind: this.parseKind(kind),
      serviceId,
      version,
      ...(existing ? {
        state: existing.state,
        createdAt: existing.createdAt,
        publishedAt: existing.publishedAt,
        deprecatedAt: existing.deprecatedAt,
        archivedAt: existing.archivedAt,
      } : {
        state: "draft" as const,
      }),
      value: this.asValue(value),
    };
    await this.store.upsert(catalogId, record);
    return {
      ok: true,
      kind: record.kind,
      serviceId,
      version,
      state: record.state,
    };
  }

  async require(catalogId: string, kind: ComponentVersionKind, serviceId: string, version: string) {
    return this.store.require(catalogId, kind, serviceId, version);
  }

  async requirePublished(catalogId: string, kind: ComponentVersionKind, serviceId: string, version: string) {
    const record = await this.require(catalogId, kind, serviceId, version);
    if (record.state !== "published") {
      throw new AppError(
        "INVALID_TRANSITION",
        `Component must be published before assembly: ${kind}/${serviceId}/${version}`,
        409,
      );
    }
    return record;
  }

  async transition(
    catalogId: string,
    kind: string,
    serviceId: string,
    version: string,
    targetState: ServiceComponentLifecycleState,
  ) {
    const record = await this.store.require(catalogId, this.parseKind(kind), serviceId, version);
    if (targetState === "archived" && this.manifests) {
      const activeManifest = await this.manifests.findActiveManifestForComponent(serviceId, record.kind, version);
      if (activeManifest) {
        throw new AppError(
          "INVALID_TRANSITION",
          `Active manifest '${activeManifest.serviceId}:${activeManifest.manifestVersion}' still references ${record.kind}/${serviceId}/${version}`,
          409,
        );
      }
    }
    const next = this.transitionRecord(record, targetState);
    await this.store.upsert(catalogId, next);
    return next;
  }

  private parseKind(kind: string): ComponentVersionKind {
    if (!isComponentVersionKind(kind)) {
      throw new AppError("INVALID_INPUT", `Unknown component kind: ${kind}`, 400);
    }
    return kind;
  }

  private asValue(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new AppError("INVALID_INPUT", "value 객체 필수", 400);
    }
    return value as Record<string, unknown>;
  }

  private transitionRecord(
    record: ServiceComponentRecord,
    targetState: ServiceComponentLifecycleState,
  ): ServiceComponentRecord {
    const allowed = transitionMap[record.state ?? "draft"];
    if (!allowed.includes(targetState)) {
      throw new AppError(
        "INVALID_TRANSITION",
        `Invalid component transition: ${(record.state ?? "draft")} -> ${targetState}`,
        409,
      );
    }
    const now = new Date().toISOString();
    return {
      ...record,
      state: targetState,
      updatedAt: now,
      ...(targetState === "published" ? { publishedAt: now } : {}),
      ...(targetState === "deprecated" ? { deprecatedAt: now } : {}),
      ...(targetState === "archived" ? { archivedAt: now } : {}),
    };
  }

  private toCandidateBucket(
    records: ServiceComponentRecord[],
    required: "required" | "optional",
  ) {
    const published = records.filter(record => record.state === "published");
    const excluded = records
      .filter(record => record.state !== "published")
      .map(record => ({
        version: record.version,
        state: record.state,
        reason: this.exclusionReason(record.state ?? "draft", required),
      }));

    return {
      published,
      excluded,
    };
  }

  private exclusionReason(
    state: ServiceComponentLifecycleState,
    required: "required" | "optional",
  ): string {
    if (state === "draft") {
      return "Not assembly-ready: publish required";
    }
    if (state === "deprecated") {
      return required === "required"
        ? "Deprecated: replace before new assembly"
        : "Deprecated: optional component omitted from new assembly";
    }
    return "Archived: unusable for new assembly";
  }
}

const transitionMap: Record<ServiceComponentLifecycleState, readonly ServiceComponentLifecycleState[]> = {
  draft: ["published"],
  published: ["deprecated"],
  deprecated: ["archived"],
  archived: [],
};
