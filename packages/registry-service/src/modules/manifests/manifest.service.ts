// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from '@nestjs/common';
import { SqliteManifestRegistry } from 'pipe-store-sqlite';
import type {
  PrefixLifecycleState,
  ManifestLifecycleState,
  ServiceVersionManifest,
} from 'pipe-store-sqlite';
import { AppError } from '../../lib/errors.js';
import type { ServiceComponentVersionStore } from '../../stores/service-component-version-store.js';
import { ServiceComponentStore } from '../services/service-component-store.js';
import type { ServiceOwnershipSpec } from '../services/service.types.js';
import { SERVICE_COMPONENT_VERSION_STORE } from '../services/service-component.service.js';
import {
  createManifestAssemblyContract,
  normalizeAssembleManifestBody,
  toServiceManifestOptions,
  validateAssembleManifestBody,
  type AssembleManifestBody,
  type ManifestAssemblyContract,
  type ServiceManifestMetadata,
} from './manifest-assembly.js';

export const MANIFEST_REGISTRY = 'MANIFEST_REGISTRY';

interface ManifestRegistryCompat {
  createManifest(
    serviceId: string,
    manifestVersion: string,
    prefixes: Record<string, string>,
    changelog?: string,
    options?: ServiceManifestMetadata,
  ): ServiceVersionManifest;
}

export interface ManifestAssemblyDiagnostic {
  readonly level: 'error' | 'warning';
  readonly code:
    | 'INVALID_INPUT'
    | 'COMPONENT_NOT_FOUND'
    | 'COMPONENT_NOT_PUBLISHED'
    | 'OWNED_PREFIX_NOT_PINNED'
    | 'PREFIX_VERSION_NOT_FOUND';
  readonly message: string;
  readonly target?: string;
  readonly details?: Record<string, unknown>;
}

export interface ManifestAssemblyValidationResult {
  readonly serviceId: string;
  readonly manifestVersion: string;
  readonly ready: boolean;
  readonly diagnostics: readonly ManifestAssemblyDiagnostic[];
  readonly qualityGate: {
    readonly id: 'manifest-assembly-compatibility';
    readonly passed: boolean;
    readonly errorCount: number;
    readonly warningCount: number;
  };
  readonly contract: ManifestAssemblyContract;
}

@Injectable()
export class ManifestService {
  private readonly components?: ServiceComponentStore;

  constructor(
    @Inject(MANIFEST_REGISTRY) private readonly registry: SqliteManifestRegistry,
    @Optional()
    @Inject(SERVICE_COMPONENT_VERSION_STORE)
    componentStore?: ServiceComponentVersionStore,
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
      throw new AppError('PREFIX_NOT_FOUND', `prefix '${prefixId}:${version}' not found`, 404);
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

  async assembleManifest(body: AssembleManifestBody, catalogId = 'demo') {
    const normalized = normalizeAssembleManifestBody(body);
    validateAssembleManifestBody(normalized);
    const validation = await this.validateManifestAssembly(normalized, catalogId);
    if (!validation.ready) {
      throw new AppError(
        'ASSEMBLY_VALIDATION_FAILED',
        validation.diagnostics
          .filter((diagnostic) => diagnostic.level === 'error')
          .map((diagnostic) => diagnostic.message)
          .join('; '),
        409,
      );
    }
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

  async validateManifestAssembly(
    body: AssembleManifestBody,
    catalogId = 'demo',
  ): Promise<ManifestAssemblyValidationResult> {
    const normalized = normalizeAssembleManifestBody(body);
    const diagnostics: ManifestAssemblyDiagnostic[] = [];

    try {
      validateAssembleManifestBody(normalized);
    } catch (error) {
      diagnostics.push(this.toInputDiagnostic(error));
    }

    await this.validatePrefixPins(normalized, diagnostics);
    await this.validateReferencedComponents(catalogId, normalized, diagnostics);
    await this.validateOwnershipCoverage(catalogId, normalized, diagnostics);

    const errorCount = diagnostics.filter((diagnostic) => diagnostic.level === 'error').length;
    const warningCount = diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length;

    return {
      serviceId: normalized.serviceId,
      manifestVersion: normalized.manifestVersion,
      ready: errorCount === 0,
      diagnostics,
      qualityGate: {
        id: 'manifest-assembly-compatibility',
        passed: errorCount === 0,
        errorCount,
        warningCount,
      },
      contract: createManifestAssemblyContract(normalized),
    };
  }

  listManifests(serviceId: string) {
    return this.registry.listManifests(serviceId);
  }

  getActiveManifest(serviceId: string) {
    return this.registry.getActiveManifest(serviceId);
  }

  async findActiveManifestForComponent(
    serviceId: string,
    kind: 'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
    version: string,
  ) {
    const manifest = this.getActiveManifest(serviceId);
    if (!manifest) {
      return null;
    }
    const matches =
      (kind === 'service-unit' && manifest.serviceUnitVersion === version) ||
      (kind === 'ownership' && manifest.ownershipVersion === version) ||
      (kind === 'exposure' && manifest.exposureVersion === version) ||
      (kind === 'runtime-address' && manifest.runtimeAddressVersion === version) ||
      (kind === 'deployment-binding' && manifest.deploymentVersion === version);
    return matches ? manifest : null;
  }

  getManifest(serviceId: string, manifestVersion: string) {
    try {
      return this.registry.getManifest(serviceId, manifestVersion);
    } catch {
      throw new AppError('NOT_FOUND', `manifest '${serviceId}:${manifestVersion}' not found`, 404);
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

  private async validateReferencedComponents(
    catalogId: string,
    body: AssembleManifestBody,
    diagnostics?: ManifestAssemblyDiagnostic[],
  ) {
    if (!this.components) {
      return;
    }
    if (body.serviceUnitVersion) {
      await this.requirePublished(
        catalogId,
        'service-unit',
        body.serviceId,
        body.serviceUnitVersion,
        diagnostics,
      );
    }
    if (body.ownershipVersion) {
      await this.requirePublished(
        catalogId,
        'ownership',
        body.serviceId,
        body.ownershipVersion,
        diagnostics,
      );
    }
    if (body.exposureVersion) {
      await this.requirePublished(
        catalogId,
        'exposure',
        body.serviceId,
        body.exposureVersion,
        diagnostics,
      );
    }
    if (body.deploymentVersion) {
      await this.requirePublished(
        catalogId,
        'deployment-binding',
        body.serviceId,
        body.deploymentVersion,
        diagnostics,
      );
    }
    if (body.runtimeAddressVersion) {
      await this.requirePublished(
        catalogId,
        'runtime-address',
        body.serviceId,
        body.runtimeAddressVersion,
        diagnostics,
      );
    }
  }

  private async resolveRuntimeAddress(catalogId: string, body: AssembleManifestBody) {
    if (body.runtimeAddress) {
      return body.runtimeAddress;
    }
    if (!body.runtimeAddressVersion || !this.components) {
      return undefined;
    }
    const record = await this.components.require(
      catalogId,
      'runtime-address',
      body.serviceId,
      body.runtimeAddressVersion,
    );
    return record.value as ServiceManifestMetadata['runtimeAddress'];
  }

  private async requirePublished(
    catalogId: string,
    kind: 'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
    serviceId: string,
    version: string,
    diagnostics?: ManifestAssemblyDiagnostic[],
  ) {
    try {
      const record = await this.components!.require(catalogId, kind, serviceId, version);
      if (record.state !== 'published') {
        const diagnostic: ManifestAssemblyDiagnostic = {
          level: 'error',
          code: 'COMPONENT_NOT_PUBLISHED',
          target: `${kind}:${serviceId}:${version}`,
          message: `Component must be published before assembly: ${kind}/${serviceId}/${version}`,
          details: { kind, serviceId, version, state: record.state },
        };
        if (diagnostics) {
          diagnostics.push(diagnostic);
          return null;
        }
        throw new AppError('INVALID_TRANSITION', diagnostic.message, 409);
      }
      return record;
    } catch (error) {
      if (diagnostics) {
        diagnostics.push(this.toComponentDiagnostic(error, kind, serviceId, version));
        return null;
      }
      throw error;
    }
  }

  private async validatePrefixPins(
    body: AssembleManifestBody,
    diagnostics: ManifestAssemblyDiagnostic[],
  ) {
    for (const [prefixId, version] of Object.entries(body.prefixes)) {
      try {
        this.registry.getPrefixRecord(prefixId, version);
      } catch {
        diagnostics.push({
          level: 'error',
          code: 'PREFIX_VERSION_NOT_FOUND',
          target: `${prefixId}:${version}`,
          message: `Pinned prefix not found: ${prefixId}:${version}`,
          details: { prefixId, version },
        });
      }
    }
  }

  private async validateOwnershipCoverage(
    catalogId: string,
    body: AssembleManifestBody,
    diagnostics: ManifestAssemblyDiagnostic[],
  ) {
    if (!this.components || !body.ownershipVersion) {
      return;
    }

    let record: Awaited<ReturnType<ServiceComponentStore['require']>> | null = null;
    try {
      record = await this.components.require(
        catalogId,
        'ownership',
        body.serviceId,
        body.ownershipVersion,
      );
    } catch {
      return;
    }
    if (record.state !== 'published') {
      return;
    }

    const ownership = record.value as ServiceOwnershipSpec;
    const missingPrefixes = ownership.ownedPrefixes.filter(
      (prefixId) => !(prefixId in body.prefixes),
    );
    if (missingPrefixes.length === 0) {
      return;
    }

    diagnostics.push({
      level: 'error',
      code: 'OWNED_PREFIX_NOT_PINNED',
      target: `ownership:${body.serviceId}:${body.ownershipVersion}`,
      message: `Ownership-owned prefixes must be pinned in manifest: ${missingPrefixes.join(', ')}`,
      details: {
        serviceId: body.serviceId,
        ownershipVersion: body.ownershipVersion,
        missingPrefixes,
      },
    });
  }

  private toInputDiagnostic(error: unknown): ManifestAssemblyDiagnostic {
    const appError = mapError(error);
    return {
      level: 'error',
      code: 'INVALID_INPUT',
      message: appError.message,
      details: { statusCode: appError.statusCode },
    };
  }

  private toComponentDiagnostic(
    error: unknown,
    kind: 'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
    serviceId: string,
    version: string,
  ): ManifestAssemblyDiagnostic {
    const appError = error instanceof AppError ? error : mapError(error);
    if (appError.code === 'NOT_FOUND') {
      return {
        level: 'error',
        code: 'COMPONENT_NOT_FOUND',
        target: `${kind}:${serviceId}:${version}`,
        message: `Component not found for assembly: ${kind}/${serviceId}/${version}`,
        details: { kind, serviceId, version },
      };
    }
    return {
      level: 'error',
      code: 'COMPONENT_NOT_PUBLISHED',
      target: `${kind}:${serviceId}:${version}`,
      message: appError.message,
      details: { kind, serviceId, version },
    };
  }
}

function mapError(err: unknown): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('이미 존재')) {
    return new AppError('DUPLICATE_ENTRY', msg, 409);
  }
  if (msg.includes('미등록')) {
    return new AppError('NOT_FOUND', msg, 404);
  }
  if (msg.includes('전이 불가') || msg.includes('draft 상태')) {
    return new AppError('INVALID_TRANSITION', msg, 409);
  }
  if (msg.includes('runtimeAddress.serviceId')) {
    return new AppError('INVALID_INPUT', msg, 400);
  }
  return new AppError('INTERNAL_ERROR', msg, 500);
}
