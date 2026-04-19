// @def.boundary registry-system
// @def.doc registry-system

import type { ComponentVersionKind } from "../modules/services/service.types.js";

export type ServiceComponentLifecycleState =
  | "draft"
  | "published"
  | "deprecated"
  | "archived";

export interface ServiceComponentVersionRecord {
  readonly catalogId: string;
  readonly kind: ComponentVersionKind;
  readonly serviceId: string;
  readonly version: string;
  readonly state: ServiceComponentLifecycleState;
  readonly valueJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
  readonly deprecatedAt?: string;
  readonly archivedAt?: string;
}

export interface ServiceComponentVersionStore {
  upsert(record: ServiceComponentVersionRecord): Promise<void>;
  get(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
    version: string,
  ): Promise<ServiceComponentVersionRecord | null>;
  listVersions(
    catalogId: string,
    kind: ComponentVersionKind,
    serviceId: string,
  ): Promise<ServiceComponentVersionRecord[]>;
}
