// @def.boundary registry-system
// @def.doc registry-system

import type {
  ComponentVersionKind,
  ComponentVersionRef,
  DeploymentAddress,
  DeploymentBinding,
  ManifestAssemblyRequest,
  RuntimeServiceAddress,
  ServiceAddressAggregate,
  ServiceExposureSpec,
  ServiceOwnershipSpec,
  ServiceRecord,
  ServiceReleaseManifestRef,
  ServiceUnitSpec,
} from './service.types.js';

export interface ServiceRecordSplitOptions {
  readonly namespace: string;
}

export interface RuntimeTarget {
  readonly env: string;
  readonly region: string;
}

export interface DeploymentTarget extends RuntimeTarget {
  readonly provider: string;
  readonly project: string;
  readonly stack: string;
  readonly resourceKey: string;
}

export interface DeploymentBindingInput {
  readonly deploymentVersion: string;
  readonly observedAt: string;
  readonly urn?: string;
  readonly url?: string;
  readonly outputs?: Readonly<Record<string, unknown>>;
}

export interface ServiceAddressAggregateInput {
  readonly record: ServiceRecord;
  readonly namespace: string;
  readonly runtimeTargets?: readonly RuntimeTarget[];
  readonly deployments?: readonly {
    target: DeploymentTarget;
    binding: DeploymentBindingInput;
  }[];
  readonly releases?: readonly ServiceReleaseManifestRef[];
}

export function toServiceUnitSpec(
  record: ServiceRecord,
  options: ServiceRecordSplitOptions,
): ServiceUnitSpec {
  return {
    serviceId: record.serviceId,
    namespace: options.namespace,
    name: record.name,
    ...(record.tier != null ? { tier: record.tier } : {}),
    ...(record.team != null ? { team: record.team } : {}),
    ...(record.applicationId != null ? { applicationId: record.applicationId } : {}),
    ...(record.attributes != null ? { attributes: record.attributes } : {}),
  };
}

export function toServiceOwnershipSpec(record: ServiceRecord): ServiceOwnershipSpec {
  return {
    serviceId: record.serviceId,
    ownedPrefixes: [...record.ownedPrefixes],
    ...(record.consumedPrefixes != null ? { consumedPrefixes: [...record.consumedPrefixes] } : {}),
  };
}

export function toServiceExposureSpec(record: ServiceRecord): ServiceExposureSpec | undefined {
  if (record.gatewayPath == null && record.stripPrefix == null) {
    return undefined;
  }
  return {
    serviceId: record.serviceId,
    ...(record.gatewayPath != null ? { gatewayPath: record.gatewayPath } : {}),
    ...(record.stripPrefix != null ? { stripPrefix: record.stripPrefix } : {}),
  };
}

export function splitServiceRecord(
  record: ServiceRecord,
  options: ServiceRecordSplitOptions,
): {
  readonly unit: ServiceUnitSpec;
  readonly ownership: ServiceOwnershipSpec;
  readonly exposure?: ServiceExposureSpec;
} {
  const exposure = toServiceExposureSpec(record);
  return {
    unit: toServiceUnitSpec(record, options),
    ownership: toServiceOwnershipSpec(record),
    ...(exposure != null ? { exposure } : {}),
  };
}

export function createRuntimeServiceAddress(
  unit: Pick<ServiceUnitSpec, 'serviceId' | 'namespace' | 'name'>,
  target: RuntimeTarget,
): RuntimeServiceAddress {
  return {
    serviceId: unit.serviceId,
    namespace: unit.namespace,
    name: unit.name,
    env: target.env,
    region: target.region,
  };
}

export function createDeploymentAddress(
  unit: Pick<ServiceUnitSpec, 'serviceId' | 'namespace' | 'name'>,
  target: DeploymentTarget,
): DeploymentAddress {
  return {
    serviceId: unit.serviceId,
    runtime: createRuntimeServiceAddress(unit, target),
    provider: target.provider,
    project: target.project,
    stack: target.stack,
    resourceKey: target.resourceKey,
  };
}

export function createDeploymentBinding(
  address: DeploymentAddress,
  input: DeploymentBindingInput,
): DeploymentBinding {
  return {
    deploymentVersion: input.deploymentVersion,
    address,
    observedAt: input.observedAt,
    ...(input.urn != null ? { urn: input.urn } : {}),
    ...(input.url != null ? { url: input.url } : {}),
    ...(input.outputs != null ? { outputs: input.outputs } : {}),
  };
}

export function createComponentVersionRef(
  kind: ComponentVersionKind,
  serviceId: string,
  version: string,
): ComponentVersionRef {
  return { kind, serviceId, version };
}

export function createManifestAssemblyRequest(
  input: ManifestAssemblyRequest,
): ManifestAssemblyRequest {
  return {
    ...input,
    prefixes: { ...input.prefixes },
  };
}

export function createServiceAddressAggregate(
  input: ServiceAddressAggregateInput,
): ServiceAddressAggregate {
  const split = splitServiceRecord(input.record, { namespace: input.namespace });
  const runtimeAddresses = (input.runtimeTargets ?? []).map((target) =>
    createRuntimeServiceAddress(split.unit, target),
  );
  const deployments = (input.deployments ?? []).map(({ target, binding }) =>
    createDeploymentBinding(createDeploymentAddress(split.unit, target), binding),
  );

  return {
    serviceId: input.record.serviceId,
    unit: split.unit,
    ownership: split.ownership,
    ...(split.exposure != null ? { exposure: split.exposure } : {}),
    runtimeAddresses,
    deployments,
    ...(input.releases != null ? { releases: [...input.releases] } : {}),
  };
}
