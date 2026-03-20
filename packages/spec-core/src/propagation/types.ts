/**
 * Propagation 전용 타입.
 */

import type { VersionEventNode } from "../dkg/dkg.types.js";

export type { VersionEventNode };

export interface VersionNotification {
  readonly event: "activated" | "deprecated" | "released";
  readonly prefix: string;
  readonly versionId: string;
  readonly previousVersion: string | null;
  readonly summary: {
    readonly capacityChanged: boolean;
    readonly migrationRequired: boolean;
    readonly changedLabels: number;
  };
  readonly affectedDomains: readonly string[];
  readonly affectedConsumers: readonly {
    readonly id: string;
    readonly action: "update-recommended" | "migration-required" | "no-action";
  }[];
  readonly constraintViolations: readonly {
    readonly constraintId: string;
    readonly rule: string;
  }[];
  readonly brokenIntentLinks: readonly {
    readonly id: string;
    readonly invariant: string;
  }[];
}
