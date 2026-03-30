export type GateRunOutcome = "pass" | "fail";
export type GateFailureClass =
  | "command-not-found"
  | "infra-transient"
  | "static-check-failure"
  | "test-failure"
  | "build-failure"
  | "audit-failure"
  | "ai-eval-failure"
  | "success-pattern-mismatch";

export interface GateRunEntry {
  id: number;
  gateDocId: string;
  docVersion: number;
  bundleId: string | null;
  command: string;
  outcome: GateRunOutcome;
  exitCode: number | null;
  executedAt: string;
  notes: string | null;
  repoRoot: string | null;
  gitBranch: string | null;
  gitSha: string | null;
  runDurationMs: number | null;
  successPattern: string | null;
  successPatternMatched: boolean | null;
  failureClass: GateFailureClass | null;
}

export type GateVerificationStatus =
  | "verified"
  | "failed"
  | "stale"
  | "unverified";

export interface GateDescriptor {
  gateDocId: string;
  docVersion: number;
  bundleId?: string | null;
}

export interface GateStatus {
  gateDocId: string;
  currentVersion: number;
  status: GateVerificationStatus;
  lastRun: GateRunEntry | null;
}

export interface BundleVerification {
  bundleId: string | null;
  totalGates: number;
  verifiedGates: number;
  verified: boolean;
  gateStatuses: ReadonlyMap<string, GateStatus>;
  blockingGateStatuses: readonly GateStatus[];
}
