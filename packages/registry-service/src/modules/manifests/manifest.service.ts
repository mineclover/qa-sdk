import { Inject, Injectable } from "@nestjs/common";
import { SqliteManifestRegistry } from "pipe-store-sqlite";
import type { PrefixLifecycleState, ManifestLifecycleState } from "pipe-store-sqlite";
import { AppError } from "../../lib/errors.js";

export const MANIFEST_REGISTRY = "MANIFEST_REGISTRY";

@Injectable()
export class ManifestService {
  constructor(
    @Inject(MANIFEST_REGISTRY) private readonly registry: SqliteManifestRegistry,
  ) {}

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
  ) {
    return this.registry.createManifest(serviceId, manifestVersion, prefixes, changelog);
  }

  listManifests(serviceId: string) {
    return this.registry.listManifests(serviceId);
  }

  getActiveManifest(serviceId: string) {
    return this.registry.getActiveManifest(serviceId);
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
  return new AppError("INTERNAL_ERROR", msg, 500);
}
