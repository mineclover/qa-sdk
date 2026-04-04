import { Inject, Injectable, Optional } from "@nestjs/common";
import { SqliteManifestRegistry } from "pipe-store-sqlite";
import type { PrefixLifecycleState, ManifestLifecycleState, ServiceVersionManifest } from "pipe-store-sqlite";
import { AppError } from "../../lib/errors.js";
import type { ServiceComponentVersionStore } from "../../stores/service-component-version-store.js";
import { ServiceComponentStore } from "../services/service-component-store.js";
import { SERVICE_COMPONENT_VERSION_STORE } from "../services/service-component.service.js";
import {
  normalizeAssembleManifestBody,
  toServiceManifestOptions,
  validateAssembleManifestBody,
  type AssembleManifestBody,
  type ServiceManifestMetadata,
} from "./manifest-assembly.js";

export const MANIFEST_REGISTRY = "MANIFEST_REGISTRY";

interface ManifestRegistryCompat {
  createManifest(
    serviceId: string,
    manifestVersion: string,
    prefixes: Record<string, string>,
    changelog?: string,
    options?: ServiceManifestMetadata,
  ): ServiceVersionManifest;
}

@Injectable()
export class ManifestService {
  private readonly components?: ServiceComponentStore;

  constructor(
    @Inject(MANIFEST_REGISTRY) private readonly registry: SqliteManifestRegistry,
    @Optional() @Inject(SERVICE_COMPONENT_VERSION_STORE) componentStore?: ServiceComponentVersionStore,
  ) {
    if (componentStore) {
      this.components = new ServiceComponentStore(componentStore);
    }
  }

  // ── Prefix 관리 ────────────────────────────────────────

  registerPrefix(prefixId: string, version: string) {
    try {
      return this.registry.registerPrefix(prefixId, version);
    } catch (err) {
      throw mapError(err);
    }
  }

  getPrefixRecord(prefixId: string, version: string) {
    try {
      return this.registry.getPrefixRecord(prefixId, version);
    } catch {
      throw new AppError("PREFIX_NOT_FOUND", `prefix '${prefixId}:${version}' not found`, 404);
    }
  }

  getActivePrefixVersion(prefixId: string) {
    return this.registry.getActivePrefixVersion(prefixId);
  }

  transitionPrefix(prefixId: string, version: string, targetState: PrefixLifecycleState) {
    try {
      return this.registry.transitionPrefix(prefixId, version, targetState);
    } catch (err) {
      throw mapError(err);
    }
  }

  // ── Manifest 관리 ──────────────────────────────────────

  createManifest(
    serviceId: string,
    manifestVersion: string,
    prefixes: Record<string, string>,
    changelog?: string,
    options?: ServiceManifestMetadata,
  ) {
    return (this.registry as unknown as ManifestRegistryCompat).createManifest(
      serviceId,
      manifestVersion,
      prefixes,
      changelog,
      options,
    );
  }

  async assembleManifest(body: AssembleManifestBody, catalogId = "demo") {
    const normalized = normalizeAssembleManifestBody(body);
    validateAssembleManifestBody(normalized);
    await this.validateReferencedComponents(catalogId, normalized);
    const runtimeAddress = await this.resolveRuntimeAddress(catalogId, normalized);
    return this.createManifest(
      normalized.serviceId,
      normalized.manifestVersion,
      normalized.prefixes,
      normalized.changelog,
      toServiceManifestOptions({
        ...normalized,
        ...(runtimeAddress ? { runtimeAddress } : {}),
      }),
    );
  }

  listManifests(serviceId: string) {
    return this.registry.listManifests(serviceId);
  }

  getActiveManifest(serviceId: string) {
    return this.registry.getActiveManifest(serviceId);
  }

  async findActiveManifestForComponent(
    serviceId: string,
    kind: "service-unit" | "ownership" | "exposure" | "runtime-address" | "deployment-binding",
    version: string,
  ) {
    const manifest = this.getActiveManifest(serviceId);
    if (!manifest) {
      return null;
    }
    const matches = (
      (kind === "service-unit" && manifest.serviceUnitVersion === version)
      || (kind === "ownership" && manifest.ownershipVersion === version)
      || (kind === "exposure" && manifest.exposureVersion === version)
      || (kind === "runtime-address" && manifest.runtimeAddressVersion === version)
      || (kind === "deployment-binding" && manifest.deploymentVersion === version)
    );
    return matches ? manifest : null;
  }

  getManifest(serviceId: string, manifestVersion: string) {
    try {
      return this.registry.getManifest(serviceId, manifestVersion);
    } catch {
      throw new AppError("NOT_FOUND", `manifest '${serviceId}:${manifestVersion}' not found`, 404);
    }
  }

  transitionManifest(
    serviceId: string,
    manifestVersion: string,
    targetState: ManifestLifecycleState,
  ) {
    try {
      return this.registry.transitionManifest(serviceId, manifestVersion, targetState);
    } catch (err) {
      throw mapError(err);
    }
  }

  private async validateReferencedComponents(catalogId: string, body: AssembleManifestBody) {
    if (!this.components) {
      return;
    }
    if (body.serviceUnitVersion) {
      await this.requirePublished(catalogId, "service-unit", body.serviceId, body.serviceUnitVersion);
    }
    if (body.ownershipVersion) {
      await this.requirePublished(catalogId, "ownership", body.serviceId, body.ownershipVersion);
    }
    if (body.exposureVersion) {
      await this.requirePublished(catalogId, "exposure", body.serviceId, body.exposureVersion);
    }
    if (body.deploymentVersion) {
      await this.requirePublished(catalogId, "deployment-binding", body.serviceId, body.deploymentVersion);
    }
    if (body.runtimeAddressVersion) {
      await this.requirePublished(catalogId, "runtime-address", body.serviceId, body.runtimeAddressVersion);
    }
  }

  private async resolveRuntimeAddress(catalogId: string, body: AssembleManifestBody) {
    if (body.runtimeAddress) {
      return body.runtimeAddress;
    }
    if (!body.runtimeAddressVersion || !this.components) {
      return undefined;
    }
    const record = await this.components.require(catalogId, "runtime-address", body.serviceId, body.runtimeAddressVersion);
    return record.value as ServiceManifestMetadata["runtimeAddress"];
  }

  private async requirePublished(
    catalogId: string,
    kind: "service-unit" | "ownership" | "exposure" | "runtime-address" | "deployment-binding",
    serviceId: string,
    version: string,
  ) {
    const record = await this.components!.require(catalogId, kind, serviceId, version);
    if (record.state !== "published") {
      throw new AppError(
        "INVALID_TRANSITION",
        `Component must be published before assembly: ${kind}/${serviceId}/${version}`,
        409,
      );
    }
    return record;
  }
}

function mapError(err: unknown): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("이미 존재")) {
    return new AppError("DUPLICATE_ENTRY", msg, 409);
  }
  if (msg.includes("미등록")) {
    return new AppError("NOT_FOUND", msg, 404);
  }
  if (msg.includes("전이 불가") || msg.includes("draft 상태")) {
    return new AppError("INVALID_TRANSITION", msg, 409);
  }
  if (msg.includes("runtimeAddress.serviceId")) {
    return new AppError("INVALID_INPUT", msg, 400);
  }
  return new AppError("INTERNAL_ERROR", msg, 500);
}
