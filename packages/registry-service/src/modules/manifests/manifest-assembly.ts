import { AppError } from "../../lib/errors.js";
import type { RuntimeServiceAddress } from "../services/service.types.js";

export interface AssembleManifestBody {
  readonly serviceId: string;
  readonly manifestVersion: string;
  readonly prefixes: Record<string, string>;
  readonly runtimeAddressVersion?: string;
  readonly serviceUnitVersion?: string;
  readonly ownershipVersion?: string;
  readonly exposureVersion?: string;
  readonly deploymentVersion?: string;
  readonly runtimeAddress?: RuntimeServiceAddress;
  readonly changelog?: string;
}

export interface ServiceManifestMetadata {
  readonly runtimeAddressVersion?: string;
  readonly serviceUnitVersion?: string;
  readonly ownershipVersion?: string;
  readonly exposureVersion?: string;
  readonly deploymentVersion?: string;
  readonly runtimeAddress?: RuntimeServiceAddress;
}

export function normalizeAssembleManifestBody(body: AssembleManifestBody): AssembleManifestBody {
  return {
    ...body,
    prefixes: { ...body.prefixes },
    ...(body.runtimeAddress != null ? { runtimeAddress: { ...body.runtimeAddress } } : {}),
  };
}

export function validateAssembleManifestBody(body: AssembleManifestBody): void {
  if (!body.serviceId) {
    throw new AppError("INVALID_INPUT", "serviceId 필수", 400);
  }
  if (!body.manifestVersion) {
    throw new AppError("INVALID_INPUT", "manifestVersion 필수", 400);
  }
  if (!body.prefixes || typeof body.prefixes !== "object" || Array.isArray(body.prefixes)) {
    throw new AppError("INVALID_INPUT", "prefixes 객체 필수", 400);
  }
  if (body.runtimeAddress && body.runtimeAddress.serviceId !== body.serviceId) {
    throw new AppError(
      "INVALID_INPUT",
      `runtimeAddress.serviceId "${body.runtimeAddress.serviceId}" != manifest serviceId "${body.serviceId}"`,
      400,
    );
  }
}

export function toServiceManifestOptions(body: AssembleManifestBody): ServiceManifestMetadata | undefined {
  if (
    body.runtimeAddressVersion == null
    && 
    body.serviceUnitVersion == null
    && body.ownershipVersion == null
    && body.exposureVersion == null
    && body.deploymentVersion == null
    && body.runtimeAddress == null
  ) {
    return undefined;
  }

  return {
    ...(body.runtimeAddressVersion != null ? { runtimeAddressVersion: body.runtimeAddressVersion } : {}),
    ...(body.serviceUnitVersion != null ? { serviceUnitVersion: body.serviceUnitVersion } : {}),
    ...(body.ownershipVersion != null ? { ownershipVersion: body.ownershipVersion } : {}),
    ...(body.exposureVersion != null ? { exposureVersion: body.exposureVersion } : {}),
    ...(body.deploymentVersion != null ? { deploymentVersion: body.deploymentVersion } : {}),
    ...(body.runtimeAddress != null ? { runtimeAddress: body.runtimeAddress } : {}),
  };
}
