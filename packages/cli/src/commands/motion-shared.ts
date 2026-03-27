import type { MotionWorkspaceSnapshotV1 } from "motion-workspace";

export interface MotionCompositionSummary {
  readonly id: string;
  readonly title: string;
  readonly durationMs: number;
  readonly parameters: number;
  readonly assets: number;
  readonly layers: number;
  readonly sequences: number;
  readonly captions: number;
  readonly transitions: number;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatWorkspaceSource(snapshot: MotionWorkspaceSnapshotV1): string {
  if (!snapshot.source) {
    return "(none)";
  }

  const parts = [
    snapshot.source.presetId ? `presetId=${snapshot.source.presetId}` : null,
    snapshot.source.storageKey ? `storageKey=${snapshot.source.storageKey}` : null,
    snapshot.source.path ? `path=${snapshot.source.path}` : null,
  ].filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(", ") : "(none)";
}
