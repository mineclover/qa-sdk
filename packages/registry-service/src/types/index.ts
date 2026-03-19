import type { DimRef } from "index-meta";

// ── Prefix Owner ──────────────────────────────────────────

export interface PrefixOwnerRecord {
  readonly prefix: string;
  readonly owner: string;
  readonly kind: "leaf" | "composite";
  readonly numberType: "number" | "bigint";
  readonly createdAt: string;
}

// ── Draft Lock ────────────────────────────────────────────

export interface DraftLock {
  readonly prefix: string;
  readonly versionId: string;
  readonly lockedAt: string;
}

// ── Diagnostics ───────────────────────────────────────────

export type DiagnosticLevel = "error" | "warn" | "info";

export interface DiagnosticEntry {
  readonly level: DiagnosticLevel;
  readonly prefix: string;
  readonly owner: string;
  readonly message: string;
}

// ── Simulate ──────────────────────────────────────────────

export interface ImpactEntry {
  readonly prefix: string;
  readonly owner: string;
  readonly currentShape: number[];
  readonly newShape: number[];
  readonly currentStride: number[];
  readonly newStride: number[];
  readonly strideChanged: boolean;
  readonly currentProduct: number;
  readonly newProduct: number;
  readonly numberType: "number" | "bigint";
  readonly migrationRequired: boolean;
}

export interface SimulateResult {
  readonly impact: ImpactEntry[];
  readonly ready: boolean;
  readonly diagnostics: DiagnosticEntry[];
  readonly releaseOrder: string[];
}

// ── Analyze ───────────────────────────────────────────────

export interface DraftInfo {
  readonly prefix: string;
  readonly versionId: string;
  readonly owner: string;
  readonly kind: "leaf" | "composite";
  readonly capacity: number;
  readonly status: "draft" | "locked";
}

export interface AnalyzeResult {
  readonly ready: boolean;
  readonly drafts: DraftInfo[];
  readonly diagnostics: DiagnosticEntry[];
  readonly releaseOrder: string[];
  readonly migrationSummary: {
    readonly prefixesAffected: number;
    readonly strideChanges: number;
    readonly numberTypeSwitches: number;
  };
}

// ── Extended Version (API 응답용) ─────────────────────────

export type ExtendedVersionStatus =
  | "draft"
  | "locked"
  | "released"
  | "active"
  | "deprecated";

export interface ExtendedVersionRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly status: ExtendedVersionStatus;
  readonly baseVersionId: string | null;
  readonly capacity: number;
  readonly deactivationMode: "strict" | "flexible";
  readonly refs?: readonly DimRef[];
  readonly shape?: number[];
  readonly stride?: number[];
  readonly product?: number;
  readonly createdAt: string;
  readonly lockedAt?: string;
  readonly releasedAt?: string | null;
}
