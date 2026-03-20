/**
 * 라이프사이클 전이 — seal + activate + 종단 파이프라인.
 *
 * draft → lock → release → activate 전이를 수행하면서
 * DKG 기록과 알림 생성을 연결한다.
 */

import type { RegistryPort } from "./registry-port.js";
import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { VersionEventNode, VersionNotification } from "./types.js";
import { versionEventFromDiff } from "../dkg/skills/version-event-derive.js";
import type { DiffInput } from "../dkg/skills/version-event-derive.js";

export interface SealInput {
  readonly prefix: string;
  readonly versionId: string;
}

export interface ActivateInput {
  readonly prefix: string;
  readonly versionId: string;
  readonly date: string;
  /** diff 정보 (있으면 VersionEvent 자동 생성) */
  readonly diff?: DiffInput;
}

export interface ActivateResult {
  readonly prefix: string;
  readonly versionId: string;
  readonly previousVersion: string | null;
  readonly versionEvent?: VersionEventNode;
  readonly notification: VersionNotification;
}

/**
 * draft → locked → released (seal).
 */
export async function seal(
  registry: RegistryPort,
  input: SealInput,
): Promise<void> {
  await registry.lockDraft(input.prefix, input.versionId);
  await registry.release(input.prefix, input.versionId);
}

/**
 * released → active + 이전 버전 deprecate + DKG 기록 + 알림 생성.
 */
export async function activateAndPropagate(
  registry: RegistryPort,
  graph: GraphRegistry,
  input: ActivateInput,
): Promise<ActivateResult> {
  // 1. 이전 active version 확인
  const previousVersion = await registry.getActiveVersion(input.prefix);

  // 2. 이전 버전 deprecate
  if (previousVersion) {
    await registry.deprecate(input.prefix, previousVersion);
  }

  // 3. activate
  await registry.activate(input.prefix, input.versionId);

  // 4. VersionEvent 생성 (diff가 있으면)
  let versionEvent: VersionEventNode | undefined;
  if (input.diff) {
    versionEvent = versionEventFromDiff(input.diff, { date: input.date });

    // DKG에 기록
    graph.addNode(versionEvent);
    if (previousVersion) {
      // evolves-from 엣지 (이전 VersionEvent가 있으면)
      const prevVeId = `VE-${input.prefix}-*-${previousVersion}`;
      // 간단히 justifies만 기록
    }
  }

  // 5. 알림 생성
  const notification = buildNotification(graph, input, previousVersion);

  return {
    prefix: input.prefix,
    versionId: input.versionId,
    previousVersion,
    versionEvent,
    notification,
  };
}

function buildNotification(
  graph: GraphRegistry,
  input: ActivateInput,
  previousVersion: string | null,
): VersionNotification {
  // prefix cascade
  const { domains, consumers } = graph.cascadeFromPrefix(input.prefix);

  // constraint 검사
  const constraints = graph.activeConstraints(input.prefix);

  // intent-link 검사
  const intentLinks = graph.intentLinksFor(input.prefix);

  const hasChanges = input.diff && input.diff.changedLabels.length > 0;
  const hasCapacityChange = input.diff?.changedLabels.some(c => c.toMax !== c.fromMax) ?? false;

  return {
    event: "activated",
    prefix: input.prefix,
    versionId: input.versionId,
    previousVersion,
    summary: {
      capacityChanged: hasCapacityChange,
      migrationRequired: hasCapacityChange,
      changedLabels: input.diff?.changedLabels.length ?? 0,
    },
    affectedDomains: domains.map(d => d.id),
    affectedConsumers: consumers.map(c => ({
      id: c.id,
      action: hasCapacityChange ? "migration-required" as const : "no-action" as const,
    })),
    constraintViolations: constraints,
    brokenIntentLinks: intentLinks
      .filter(l => l.invariant)
      .map(l => ({ id: l.id, invariant: l.invariant! })),
  };
}
