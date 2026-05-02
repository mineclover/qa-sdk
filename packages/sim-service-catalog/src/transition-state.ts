import { parseServicePrefix, parseVersionTag } from "sim-identifier-grammar";
import type {
  CatalogPrefixDefinition,
  ServiceState,
  TransitionLog,
  VersionEntry,
} from "./types.js";

/**
 * spec 02 §2.3: 허용 전이는 candidate → {stable, retired} 두 가지.
 * - candidate → stable: 옛 stable은 자동 retired (정방향 승격)
 * - candidate → retired: 롤백
 * 그 외(retired→*, stable→candidate)는 모두 illegal.
 */
const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [ServiceState, ServiceState]> = [
  ["candidate", "stable"],
  ["candidate", "retired"],
];

export interface TransitionInput {
  from: VersionEntry;
  to: VersionEntry;
  /** 성공 전이 시 호출 — 호출 측이 audit-recorder/ingest 발행 책임. */
  onTransition?: (log: TransitionLog) => void;
  /** controller가 단조 증가로 관리. 미지정 시 1. */
  revision?: number;
  occurredAt?: string;
}

export interface TransitionResult {
  catalog: CatalogPrefixDefinition;
  log: TransitionLog;
}

export function transitionState(
  catalog: CatalogPrefixDefinition,
  input: TransitionInput,
): TransitionResult {
  parseServicePrefix(catalog.prefix);
  parseVersionTag(input.from.version);
  parseVersionTag(input.to.version);

  const allowed = ALLOWED_TRANSITIONS.some(
    ([f, t]) => f === input.from.state && t === input.to.state,
  );
  if (!allowed) {
    throw new Error(
      `transitionState: illegal transition ${input.from.state} → ${input.to.state} (prefix=${catalog.prefix})`,
    );
  }

  const fromIdx = catalog.refEntries.findIndex(
    (e) => e.version === input.from.version && e.state === input.from.state,
  );
  if (fromIdx < 0) {
    throw new Error(
      `transitionState: from entry not found — prefix=${catalog.prefix} version=${input.from.version} state=${input.from.state}`,
    );
  }

  const next: VersionEntry[] = catalog.refEntries.map((e) => ({ ...e }));
  next[fromIdx] = { version: input.to.version, state: input.to.state };

  if (input.from.state === "candidate" && input.to.state === "stable") {
    for (let i = 0; i < next.length; i++) {
      if (i === fromIdx) continue;
      if (next[i].state === "stable") next[i] = { ...next[i], state: "retired" };
    }
  }

  // invariant: stable=1, candidate≤1
  const stableCount = next.filter((e) => e.state === "stable").length;
  const candidateCount = next.filter((e) => e.state === "candidate").length;
  if (stableCount !== 1) {
    throw new Error(`transitionState: invariant 위반 — stable count=${stableCount}`);
  }
  if (candidateCount > 1) {
    throw new Error(`transitionState: invariant 위반 — candidate count=${candidateCount}`);
  }

  const log: TransitionLog = {
    prefix: catalog.prefix,
    from: input.from,
    to: input.to,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    revision: input.revision ?? 1,
  };
  input.onTransition?.(log); // invariant 통과 후에만
  return { catalog: { ...catalog, refEntries: next }, log };
}
