// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { SqliteQualityStore } from "./store.js";
import type {
  BundleVerification,
  GateFailureClass,
  GateDescriptor,
  GateRunEntry,
  GateStatus,
} from "./types.js";

export class QualityLedger {
  readonly store: SqliteQualityStore;

  constructor(store: SqliteQualityStore) {
    this.store = store;
  }

  recordRun(input: {
    gateDocId: string;
    docVersion: number;
    bundleId?: string | null;
    command: string;
    outcome: "pass" | "fail";
    exitCode?: number | null;
    notes?: string | null;
    repoRoot?: string | null;
    gitBranch?: string | null;
    gitSha?: string | null;
    runDurationMs?: number | null;
    successPattern?: string | null;
    successPatternMatched?: boolean | null;
    failureClass?: GateFailureClass | null;
  }): void {
    this.store.insert({
      ...input,
      executedAt: new Date().toISOString(),
    });
  }

  statusForGate(descriptor: GateDescriptor): GateStatus {
    const lastRun = this.store.getLatestByGate(descriptor.gateDocId);
    return this.toStatus(descriptor, lastRun);
  }

  statusForGates(descriptors: GateDescriptor[]): Map<string, GateStatus> {
    const latest = this.store.getLatestByGates(descriptors.map((d) => d.gateDocId));
    const result = new Map<string, GateStatus>();

    for (const descriptor of descriptors) {
      result.set(
        descriptor.gateDocId,
        this.toStatus(descriptor, latest.get(descriptor.gateDocId) ?? null),
      );
    }

    return result;
  }

  resolveBundleVerification(descriptors: GateDescriptor[]): BundleVerification {
    const gateStatuses = this.statusForGates(descriptors);
    const blockingGateStatuses = descriptors
      .map((descriptor) => gateStatuses.get(descriptor.gateDocId))
      .filter((status): status is GateStatus => status !== undefined && status.status !== "verified");

    return {
      bundleId: descriptors[0]?.bundleId ?? null,
      totalGates: descriptors.length,
      verifiedGates: descriptors.length - blockingGateStatuses.length,
      verified: descriptors.length > 0 && blockingGateStatuses.length === 0,
      gateStatuses,
      blockingGateStatuses,
    };
  }

  isBundleVerified(descriptors: GateDescriptor[]): boolean {
    return this.resolveBundleVerification(descriptors).verified;
  }

  history(gateDocId: string, limit = 20): GateRunEntry[] {
    return this.store.history(gateDocId, limit);
  }

  private toStatus(descriptor: GateDescriptor, lastRun: GateRunEntry | null): GateStatus {
    if (!lastRun) {
      return {
        gateDocId: descriptor.gateDocId,
        currentVersion: descriptor.docVersion,
        status: "unverified",
        lastRun: null,
      };
    }

    if (lastRun.docVersion !== descriptor.docVersion) {
      return {
        gateDocId: descriptor.gateDocId,
        currentVersion: descriptor.docVersion,
        status: "stale",
        lastRun,
      };
    }

    return {
      gateDocId: descriptor.gateDocId,
      currentVersion: descriptor.docVersion,
      status: lastRun.outcome === "pass" ? "verified" : "failed",
      lastRun,
    };
  }
}
