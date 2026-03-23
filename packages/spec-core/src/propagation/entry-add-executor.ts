/**
 * entry-add-executor — 축 entry 추가 실행기.
 *
 * index-meta / foundation.md 원칙 준수:
 *   - Position 불변: append-only, 기존 entry 위치 변경 없음
 *   - Capacity 단조 증가: headroom 내 추가는 stride 보존, 확장 시 power-of-2
 *   - Stride determinism: capacity 변경 없으면 stride 불변
 *   - SSOT: active version이 position의 단일 출처
 *   - 멱등: DKG에 동일 VersionEvent가 이미 있으면 건너뜀
 *
 * 워크플로우: check → mutate → DKG record → persist
 */

import type { Catalog } from "@qa-sdk/core";
import type { GraphRegistry } from "../dkg/graph-registry.js";
import type {
  DkgNode,
  AxisNode,
  VersionEventNode,
  VersionChange,
} from "../dkg/dkg.types.js";
import { safeEntryAdd, type SafeEntryAddResult } from "../dkg/skills/safe-entry-add.js";
import {
  addEntryToCatalog,
  expandCapacity,
  type CatalogMutationResult,
} from "./catalog-mutator.js";

// ── Types ──

export interface EntryAddResult {
  readonly check: SafeEntryAddResult;
  readonly mutation: CatalogMutationResult;
  readonly versionEvent: VersionEventNode;
  readonly graphUpdated: boolean;
  readonly capacityExpanded: boolean;
  readonly warnings: readonly string[];
}

export interface EntryAddOptions {
  /** true면 검사 + 변이 계산만, 그래프/스토어 반영 안 함 */
  readonly dryRun?: boolean;
  /** headroom 부족 시 capacity를 자동 확장 (power-of-2). stride-break 발생 */
  readonly expandCapacity?: boolean;
  /** DkgSqliteStore (제공 시 persist) */
  readonly store?: {
    updateNode(node: DkgNode, source?: "bootstrap" | "manual" | "auto"): void;
  };
}

// ── Executor ──

/**
 * 축에 entry를 추가한다.
 *
 * @throws verdict가 "safe"도 아니고 expandCapacity도 false면 에러
 */
export function executeEntryAdd(
  catalog: Catalog,
  graph: GraphRegistry,
  axisId: string,
  entry: string,
  options?: EntryAddOptions,
): EntryAddResult {
  const warnings: string[] = [];

  // ── 1. 멱등성 — 동일 entry에 대한 VersionEvent가 이미 존재하는지 확인 ──
  const existingEvents = graph.getNodesByKind("version-event");
  const alreadyRecorded = existingEvents.some(
    (e) =>
      e.subjectId === axisId &&
      e.changes.some((c) => c.kind === "entry-added" && c.detail.includes(`"${entry}"`)),
  );
  if (alreadyRecorded) {
    throw new EntryAddError(
      "already-recorded",
      `"${entry}" → ${axisId}: 이미 VersionEvent에 기록됨. 멱등 보호.`,
    );
  }

  // ── 2. 안전성 검사 ──
  const check = safeEntryAdd(catalog, graph, { axisId, entry });

  let capacityExpanded = false;

  if (check.verdict === "already-exists") {
    throw new EntryAddError("already-exists", check.summary);
  }

  if (check.verdict === "needs-capacity") {
    if (!options?.expandCapacity) {
      throw new EntryAddError(
        "needs-capacity",
        `${check.summary}\n  → --expand-capacity 플래그로 자동 확장 (stride-break 발생, 기존 주소 재인코딩 필요)`,
      );
    }
    // capacity 확장 후 재시도
    capacityExpanded = true;
    warnings.push(
      `⚠ capacity 확장: stride-break 발생. 기존 인코딩된 주소는 decode(old) → re-encode(new) 필요.`,
    );
  }

  if (check.verdict === "constraint-violation") {
    throw new EntryAddError("constraint-violation", check.summary);
  }

  // ── 3. 카탈로그 변이 ──
  let mutation: CatalogMutationResult;
  if (capacityExpanded) {
    const expanded = expandCapacity(catalog, axisId);
    mutation = addEntryToCatalog(expanded.catalog, axisId, entry);
    warnings.push(
      `capacity: ${expanded.oldCapacity} → ${expanded.newCapacity} (×2)`,
    );
    // capacity 확장도 changes에 기록
    mutation = {
      ...mutation,
      capacityChange: { from: expanded.oldCapacity, to: expanded.newCapacity },
    };
  } else {
    mutation = addEntryToCatalog(catalog, axisId, entry);
  }

  // refEntries 경고
  if (mutation.updatedPrefixVersions.length > 0) {
    warnings.push(
      `prefix_ref를 사용하는 prefix의 refEntries 재계산이 필요합니다: ${mutation.updatedPrefixVersions.map((p) => p.prefixId).join(", ")}`,
    );
  }

  // ── 4. VersionEvent 생성 ──
  const date = new Date().toISOString().split("T")[0]!;
  const changes: VersionChange[] = [
    { kind: "entry-added", detail: `"${entry}" added to ${axisId}` },
  ];
  if (capacityExpanded) {
    changes.push({
      kind: "capacity-changed",
      detail: `capacity expanded: ${mutation.capacityChange?.from} → ${mutation.capacityChange?.to}`,
    });
  }

  const versionEvent: VersionEventNode = {
    kind: "version-event",
    id: `VER-AXIS-${axisId}-${mutation.newVersion}-${date}`,
    subjectId: axisId,
    subjectKind: "axis",
    fromVersion: mutation.oldVersion,
    toVersion: mutation.newVersion,
    date,
    changes,
    impact:
      mutation.affectedPrefixes.length > 0
        ? `${mutation.affectedPrefixes.length} prefix 영향: ${mutation.affectedPrefixes.join(", ")}`
        : "영향 없음",
  };

  // ── 5. 그래프 반영 ──
  const dryRun = options?.dryRun ?? false;

  if (!dryRun) {
    const axisNode = graph.getNode(axisId) as AxisNode | undefined;
    if (axisNode) {
      graph.replaceNode({
        ...axisNode,
        currentVersions: [...axisNode.currentVersions, mutation.newVersion],
      });
    }

    graph.addNode(versionEvent);
    graph.addEdge("evolves-from", versionEvent.id, axisId);

    // ── 6. SQLite 저장 ──
    if (options?.store) {
      if (axisNode) {
        options.store.updateNode(
          {
            ...axisNode,
            currentVersions: [...axisNode.currentVersions, mutation.newVersion],
          },
          "manual",
        );
      }
      options.store.updateNode(versionEvent, "manual");
    }
  }

  return {
    check,
    mutation,
    versionEvent,
    graphUpdated: !dryRun,
    capacityExpanded,
    warnings,
  };
}

// ── Error ──

export class EntryAddError extends Error {
  constructor(
    readonly verdict: string,
    message: string,
  ) {
    super(message);
    this.name = "EntryAddError";
  }
}
