// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppError } from '@qa-sdk/core';
import { REGISTRY_SERVICE } from '../../registry-core.module.js';
import { RegistryService } from '../../lib/registry-service.js';
import { ManifestService } from '../manifests/manifest.service.js';
import { ServiceComponentService } from '../services/service-component.service.js';
import { EndpointService } from '../services/endpoint.service.js';
import type {
  DeploymentBinding,
  RuntimeServiceAddress,
  ServiceExposureSpec,
  ServiceOwnershipSpec,
  ServiceUnitSpec,
} from '../services/service.types.js';

@Injectable()
export class ResolveService {
  constructor(
    @Inject(REGISTRY_SERVICE) private readonly registry: RegistryService,
    @Optional() @Inject(ManifestService) private readonly manifests?: ManifestService,
    @Optional()
    @Inject(ServiceComponentService)
    private readonly components?: ServiceComponentService,
    @Optional() @Inject(EndpointService) private readonly endpoints?: EndpointService,
  ) {}

  resolveAllActive() {
    return this.registry.resolveAllActive();
  }

  getActive(prefix: string) {
    return this.registry.getActiveEnriched(prefix);
  }

  resolveManifest() {
    return this.registry.resolveManifest();
  }

  inspectMeta(prefix: string, versionId: string) {
    return this.registry.inspectMeta(prefix, versionId);
  }

  inspectKeys(prefix: string, versionId: string) {
    return this.registry.inspectKeys(prefix, versionId);
  }

  inspectValue(prefix: string, versionId: string, address: number) {
    return this.registry.inspectValue(prefix, versionId, address);
  }

  async resolveServiceRelease(
    serviceId: string,
    query: {
      catalogId: string;
      manifestVersion?: string;
      env?: string;
      region?: string;
      project?: string;
      stack?: string;
      resourceKey?: string;
    },
  ) {
    if (!this.manifests || !this.components || !this.endpoints) {
      throw new AppError('INTERNAL_ERROR', 'service resolve dependencies not configured', 500);
    }

    const manifest = query.manifestVersion
      ? this.manifests.getManifest(serviceId, query.manifestVersion)
      : this.manifests.getActiveManifest(serviceId);

    if (!manifest) {
      throw new AppError('NOT_FOUND', `active manifest '${serviceId}' not found`, 404);
    }

    const unit = manifest.serviceUnitVersion
      ? await this.getComponentValue<ServiceUnitSpec>(
          query.catalogId,
          'service-unit',
          serviceId,
          manifest.serviceUnitVersion,
        )
      : undefined;
    const ownership = manifest.ownershipVersion
      ? await this.getComponentValue<ServiceOwnershipSpec>(
          query.catalogId,
          'ownership',
          serviceId,
          manifest.ownershipVersion,
        )
      : undefined;
    const exposure = manifest.exposureVersion
      ? await this.getComponentValue<ServiceExposureSpec>(
          query.catalogId,
          'exposure',
          serviceId,
          manifest.exposureVersion,
        )
      : undefined;

    const runtimeAddress: RuntimeServiceAddress | undefined = manifest.runtimeAddress
      ? {
          serviceId: manifest.runtimeAddress.serviceId,
          namespace: manifest.runtimeAddress.namespace,
          name: manifest.runtimeAddress.name,
          env: manifest.runtimeAddress.env,
          region: manifest.runtimeAddress.region,
        }
      : undefined;

    const deploymentBinding = manifest.deploymentVersion
      ? await this.getComponentValue<DeploymentBinding>(
          query.catalogId,
          'deployment-binding',
          serviceId,
          manifest.deploymentVersion,
        )
      : undefined;

    const endpoint = await this.resolveEndpoint(query.catalogId, runtimeAddress, deploymentBinding);

    return {
      serviceId,
      manifestVersion: manifest.manifestVersion,
      runtimeAddress,
      unit,
      ownership,
      exposure,
      deploymentBinding,
      ...(endpoint ? { endpoint } : {}),
      prefixes: manifest.prefixes,
      versions: {
        runtimeAddressVersion: manifest.runtimeAddressVersion,
        serviceUnitVersion: manifest.serviceUnitVersion,
        ownershipVersion: manifest.ownershipVersion,
        exposureVersion: manifest.exposureVersion,
        deploymentVersion: manifest.deploymentVersion,
      },
      selection: {
        deploymentBinding: manifest.deploymentVersion ? 'manifest-pinned' : 'none',
        endpoint: endpoint
          ? deploymentBinding?.url
            ? 'deployment-binding'
            : 'service-endpoint'
          : 'none',
      },
    };
  }

  async getServiceReleaseWarnings(
    serviceId: string,
    query: {
      catalogId: string;
      manifestVersion?: string;
    },
  ) {
    if (!this.manifests || !this.components) {
      throw new AppError('INTERNAL_ERROR', 'service warning dependencies not configured', 500);
    }

    const manifest = query.manifestVersion
      ? this.manifests.getManifest(serviceId, query.manifestVersion)
      : this.manifests.getActiveManifest(serviceId);

    if (!manifest) {
      throw new AppError('NOT_FOUND', `active manifest '${serviceId}' not found`, 404);
    }

    const warnings = (
      await Promise.all([
        this.collectDeprecatedWarning(
          query.catalogId,
          serviceId,
          manifest.manifestVersion,
          'runtime-address',
          manifest.runtimeAddressVersion,
        ),
        this.collectDeprecatedWarning(
          query.catalogId,
          serviceId,
          manifest.manifestVersion,
          'service-unit',
          manifest.serviceUnitVersion,
        ),
        this.collectDeprecatedWarning(
          query.catalogId,
          serviceId,
          manifest.manifestVersion,
          'ownership',
          manifest.ownershipVersion,
        ),
        this.collectDeprecatedWarning(
          query.catalogId,
          serviceId,
          manifest.manifestVersion,
          'exposure',
          manifest.exposureVersion,
        ),
        this.collectDeprecatedWarning(
          query.catalogId,
          serviceId,
          manifest.manifestVersion,
          'deployment-binding',
          manifest.deploymentVersion,
        ),
      ])
    ).filter((warning): warning is DeprecatedComponentWarning => warning != null);

    return {
      serviceId,
      manifestVersion: manifest.manifestVersion,
      summary: {
        total: warnings.length,
        deprecatedReferences: warnings.length,
        byKind: warnings.reduce<Record<string, number>>((acc, warning) => {
          acc[warning.kind] = (acc[warning.kind] ?? 0) + 1;
          return acc;
        }, {}),
      },
      warnings,
    };
  }

  async getServiceCleanupPlan(
    serviceId: string,
    query: {
      catalogId: string;
      manifestVersion?: string;
    },
  ) {
    const warningResult = await this.getServiceReleaseWarnings(serviceId, query);
    const items = await Promise.all(
      warningResult.warnings.map(async (warning) => {
        const candidates = await this.components!.listPublishedVersions(
          query.catalogId,
          warning.kind,
          serviceId,
        );
        const candidateVersions = candidates
          .map((candidate) => candidate.version)
          .filter((version) => version !== warning.version);
        const suggestedVersion = candidateVersions.length === 1 ? candidateVersions[0] : undefined;
        const status =
          candidateVersions.length === 0
            ? 'blocked'
            : candidateVersions.length === 1
              ? 'replaceable'
              : 'ambiguous';
        return {
          kind: warning.kind,
          currentVersion: warning.version,
          candidateVersions,
          ...(suggestedVersion ? { suggestedVersion } : {}),
          status,
        };
      }),
    );

    return {
      serviceId,
      manifestVersion: warningResult.manifestVersion,
      ready: items.every((item) => item.status === 'replaceable'),
      items,
      warnings: warningResult.warnings,
    };
  }

  async createCleanupDraft(
    serviceId: string,
    body: {
      catalogId?: string;
      sourceManifestVersion?: string;
      newManifestVersion: string;
      replacements?: Partial<Record<CleanupComponentKind, string>>;
      changelog?: string;
    },
  ) {
    if (!this.manifests || !this.components) {
      throw new AppError('INTERNAL_ERROR', 'cleanup dependencies not configured', 500);
    }
    const catalogId = body.catalogId ?? 'demo';
    const manifest = body.sourceManifestVersion
      ? this.manifests.getManifest(serviceId, body.sourceManifestVersion)
      : this.manifests.getActiveManifest(serviceId);

    if (!manifest) {
      throw new AppError('NOT_FOUND', `active manifest '${serviceId}' not found`, 404);
    }

    const plan = await this.getServiceCleanupPlan(serviceId, {
      catalogId,
      manifestVersion: manifest.manifestVersion,
    });

    const pickReplacement = (
      kind: CleanupComponentKind,
      currentVersion?: string,
    ): string | undefined => {
      if (!currentVersion) return undefined;
      const explicit = body.replacements?.[kind];
      if (explicit) return explicit;
      const item = plan.items.find(
        (entry) => entry.kind === kind && entry.currentVersion === currentVersion,
      );
      if (!item) return currentVersion;
      if (!item.suggestedVersion) {
        throw new AppError(
          'INVALID_TRANSITION',
          `cleanup draft blocked: ${kind}/${serviceId}/${currentVersion}`,
          409,
        );
      }
      return item.suggestedVersion;
    };

    const runtimeAddressVersion = pickReplacement(
      'runtime-address',
      manifest.runtimeAddressVersion,
    );
    const serviceUnitVersion = pickReplacement('service-unit', manifest.serviceUnitVersion);
    const ownershipVersion = pickReplacement('ownership', manifest.ownershipVersion);
    const exposureVersion = pickReplacement('exposure', manifest.exposureVersion);
    const deploymentVersion = pickReplacement('deployment-binding', manifest.deploymentVersion);

    const runtimeAddress = runtimeAddressVersion
      ? ((
          await this.components.requirePublished(
            catalogId,
            'runtime-address',
            serviceId,
            runtimeAddressVersion,
          )
        ).value as RuntimeServiceAddress)
      : manifest.runtimeAddress
        ? {
            serviceId: manifest.runtimeAddress.serviceId,
            namespace: manifest.runtimeAddress.namespace,
            name: manifest.runtimeAddress.name,
            env: manifest.runtimeAddress.env,
            region: manifest.runtimeAddress.region,
          }
        : undefined;

    const draft = this.manifests.createManifest(
      serviceId,
      body.newManifestVersion,
      manifest.prefixes,
      body.changelog ?? `cleanup draft from ${manifest.manifestVersion}`,
      {
        runtimeAddressVersion,
        serviceUnitVersion,
        ownershipVersion,
        exposureVersion,
        deploymentVersion,
        ...(runtimeAddress ? { runtimeAddress } : {}),
      },
    );

    return {
      ok: true,
      sourceManifestVersion: manifest.manifestVersion,
      manifestVersion: draft.manifestVersion,
      replacements: {
        runtimeAddressVersion,
        serviceUnitVersion,
        ownershipVersion,
        exposureVersion,
        deploymentVersion,
      },
    };
  }

  async activateCleanupDraft(
    serviceId: string,
    body: {
      catalogId?: string;
      manifestVersion: string;
    },
  ) {
    if (!this.manifests) {
      throw new AppError('INTERNAL_ERROR', 'cleanup activation dependencies not configured', 500);
    }

    const catalogId = body.catalogId ?? 'demo';
    const target = this.manifests.getManifest(serviceId, body.manifestVersion);
    const previousActive = this.manifests.getActiveManifest(serviceId);

    if (target.state === 'active') {
      throw new AppError(
        'INVALID_TRANSITION',
        `cleanup activation target already active: ${serviceId}:${body.manifestVersion}`,
        409,
      );
    }
    if (target.state !== 'draft' && target.state !== 'published') {
      throw new AppError(
        'INVALID_TRANSITION',
        `cleanup activation requires draft or published manifest: ${serviceId}:${body.manifestVersion}`,
        409,
      );
    }

    const warnings = await this.getServiceReleaseWarnings(serviceId, {
      catalogId,
      manifestVersion: body.manifestVersion,
    });
    if (warnings.warnings.length > 0) {
      throw new AppError(
        'INVALID_TRANSITION',
        `cleanup activation blocked by deprecated references: ${serviceId}:${body.manifestVersion}`,
        409,
      );
    }

    const published =
      target.state === 'draft'
        ? this.manifests.transitionManifest(serviceId, body.manifestVersion, 'published')
        : target;
    const active = this.manifests.transitionManifest(
      serviceId,
      published.manifestVersion,
      'active',
    );

    return {
      ok: true,
      previousActiveManifestVersion: previousActive?.manifestVersion ?? null,
      activatedManifestVersion: active.manifestVersion,
      state: active.state,
      warningsCleared: true,
    };
  }

  private async getComponentValue<T>(
    catalogId: string,
    kind: 'service-unit' | 'ownership' | 'exposure' | 'deployment-binding',
    serviceId: string,
    version: string,
  ): Promise<T> {
    const record = await this.components!.get(catalogId, kind, serviceId, version);
    return record.value as T;
  }

  private async collectDeprecatedWarning(
    catalogId: string,
    serviceId: string,
    manifestVersion: string,
    kind: 'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
    version?: string,
  ): Promise<DeprecatedComponentWarning | null> {
    if (!version) {
      return null;
    }
    const record = await this.components!.get(catalogId, kind, serviceId, version);
    if (record.state !== 'deprecated') {
      return null;
    }
    return {
      code: 'DEPRECATED_COMPONENT_REFERENCE',
      severity: 'warning',
      serviceId,
      manifestVersion,
      kind,
      version,
      message: `Manifest '${serviceId}:${manifestVersion}' references deprecated component ${kind}/${serviceId}/${version}`,
    };
  }

  private async resolveEndpoint(
    catalogId: string,
    runtimeAddress?: RuntimeServiceAddress,
    deploymentBinding?: DeploymentBinding,
  ): Promise<{ url: string } | undefined> {
    if (deploymentBinding?.url) {
      return { url: deploymentBinding.url };
    }
    if (!runtimeAddress) {
      return undefined;
    }
    try {
      return await this.endpoints!.resolve(
        catalogId,
        runtimeAddress.namespace,
        runtimeAddress.name,
        runtimeAddress.env,
        runtimeAddress.region,
      );
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') {
        return undefined;
      }
      throw error;
    }
  }
}

export interface DeprecatedComponentWarning {
  readonly code: 'DEPRECATED_COMPONENT_REFERENCE';
  readonly severity: 'warning';
  readonly serviceId: string;
  readonly manifestVersion: string;
  readonly kind:
    | 'service-unit'
    | 'ownership'
    | 'exposure'
    | 'runtime-address'
    | 'deployment-binding';
  readonly version: string;
  readonly message: string;
}

type CleanupComponentKind =
  | 'service-unit'
  | 'ownership'
  | 'exposure'
  | 'runtime-address'
  | 'deployment-binding';
