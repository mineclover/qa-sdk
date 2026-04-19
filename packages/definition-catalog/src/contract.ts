// @def.doc definition-contract

/**
 * 계약 조립 (Contract Assembly)
 *
 * 계약 그룹 문서의 contains 관계를 따라 멤버 문서에서
 * 계약 요소(inputs, outputs, preconditions 등)를 마커 기반으로 추출하고
 * 하나의 구조화된 계약으로 조립한다.
 *
 * HyEvo Layer 3 (Typed Spec Layer)에 대응한다.
 * 기존 축 체계를 그대로 활용하여, 계약이 좌표 공간의 문서 constellation으로 표현된다.
 *
 * assembleContract("order-create-contract")
 *   → 그룹 purpose + inputs + outputs + preconditions + steps + ...
 */

import type { DefinitionEntry, DefinitionLink, DefScope } from "./types.js";
import { findMarkedSections } from "./extract.js";
import { CONTRACT_MARKERS, type ContractMarkerKind, type ContractMarkerDef } from "./taxonomy.js";

// ── evidence 파싱은 contract-evidence.ts에 분리. re-export로 하위 호환. ──
import { parseEvidenceItems } from "./contract-evidence.js";
import type { EvidenceItem } from "./contract-evidence.js";
export type { Reversibility, EvidenceItem } from "./contract-evidence.js";
export { parseEvidenceItems };

// ── stats/rendering은 contract-stats.ts에 분리. ──
import type { ContractStats } from "./contract-stats.js";
import { computeStats, extractPurpose, renderContract } from "./contract-stats.js";
export type { ContractStats } from "./contract-stats.js";

// ─── 타입 ────────────────────────────────────────────────

/** 계약 섹션 1건 — 특정 문서에서 추출한 계약 요소 */
export interface ContractSection {
  /** 마커 이름 */
  readonly marker: ContractMarkerKind;
  /** 섹션 본문 */
  readonly body: string;
  /** 원본 문서 ID */
  readonly sourceId: string;
  /** 원본 문서 scope */
  readonly sourceScope: DefScope;
  /** 원본 문서 depth */
  readonly sourceDepth: string;
  /** 마커 정의 (modeHint, contractRole 포함) */
  readonly markerDef: ContractMarkerDef;
}

/** 조립된 계약 */
export interface AssembledContract {
  /** 그룹 문서 */
  readonly group: {
    readonly id: string;
    readonly title: string;
    readonly purpose: string | null;
  };
  /** 입력 정의 (^inputs) */
  readonly inputs: readonly ContractSection[];
  /** 출력 정의 (^outputs) */
  readonly outputs: readonly ContractSection[];
  /** 사전 조건 (^precondition) */
  readonly preconditions: readonly ContractSection[];
  /** 사후 조건 (^postcondition) */
  readonly postconditions: readonly ContractSection[];
  /** 실행 단계 (^flow-steps) */
  readonly steps: readonly ContractSection[];
  /** 분기 지점 (^decision-point) */
  readonly decisionPoints: readonly ContractSection[];
  /** 실패 조건 (^failure) */
  readonly failures: readonly ContractSection[];
  /** 증거 요구사항 (^evidence) */
  readonly evidence: readonly ContractSection[];
  /** 파싱된 증거 항목 (가역성 어노테이션 포함) */
  readonly parsedEvidence: readonly EvidenceItem[];
  /** 전체 섹션 (마커 종류별 분류 전) */
  readonly allSections: readonly ContractSection[];
  /** 멤버 문서 ID 목록 */
  readonly memberIds: readonly string[];
  /** 계약 통계 */
  readonly stats: ContractStats;
  /** 텍스트 렌더링 */
  readonly text: string;
}

// ContractStats 인터페이스는 contract-stats.ts에 분리됨

// ─── 마커 → 슬롯 매핑 ──────────────────────────────────

const MARKER_TO_DEF = new Map<string, ContractMarkerDef>(
  CONTRACT_MARKERS.map(m => [m.marker, m]),
);

// ─── 조립 함수 ──────────────────────────────────────────

/**
 * 계약 그룹 문서에서 멤버를 조립하여 구조화된 계약을 생성한다.
 *
 * @param groupId 계약 그룹 문서 ID (depth: overview, contains 링크 보유)
 * @param getEntry 문서 조회
 * @param getLinks 관계 조회
 * @param getBody 본문 조회 (ID → markdown body)
 */
export function assembleContract(
  groupId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
  getBody: (id: string) => string | undefined,
): AssembledContract | null {
  const group = getEntry(groupId);
  if (!group) return null;

  // 그룹 purpose 추출
  const groupBody = getBody(groupId);
  const groupPurpose = groupBody ? extractPurpose(groupBody) : null;

  // contains 멤버 수집
  const containsLinks = getLinks(groupId, "outgoing").filter(l => l.linkType === "contains");
  const allSections: ContractSection[] = [];
  const memberIds: string[] = [];

  for (const link of containsLinks) {
    const member = getEntry(link.targetId);
    if (!member) continue;
    memberIds.push(member.id);

    const body = getBody(member.id);
    if (!body) continue;

    // 문서에서 모든 마커 섹션을 추출
    const markedSections = findMarkedSections(body);
    for (const section of markedSections) {
      const markerDef = MARKER_TO_DEF.get(section.marker);
      if (!markerDef) continue; // 계약 마커가 아니면 건너뜀

      allSections.push({
        marker: section.marker as ContractMarkerKind,
        body: section.body,
        sourceId: member.id,
        sourceScope: member.scope,
        sourceDepth: member.depth,
        markerDef,
      });
    }
  }

  // 그룹 문서 자체에서도 계약 마커 추출 (그룹에 직접 작성된 경우)
  if (groupBody) {
    const groupSections = findMarkedSections(groupBody);
    for (const section of groupSections) {
      const markerDef = MARKER_TO_DEF.get(section.marker);
      if (!markerDef) continue;

      allSections.push({
        marker: section.marker as ContractMarkerKind,
        body: section.body,
        sourceId: groupId,
        sourceScope: group.scope,
        sourceDepth: group.depth,
        markerDef,
      });
    }
  }

  // 슬롯별 분류
  const inputs = allSections.filter(s => s.marker === "inputs");
  const outputs = allSections.filter(s => s.marker === "outputs");
  const preconditions = allSections.filter(s => s.marker === "precondition");
  const postconditions = allSections.filter(s => s.marker === "postcondition");
  const steps = allSections.filter(s => s.marker === "flow-steps");
  const decisionPoints = allSections.filter(s => s.marker === "decision-point");
  const failures = allSections.filter(s => s.marker === "failure");
  const evidence = allSections.filter(s => s.marker === "evidence");

  // evidence 항목 파싱 (가역성 어노테이션 포함)
  const parsedEvidence = evidence.flatMap(s => parseEvidenceItems(s.body, s.sourceId));

  // 통계 계산
  const stats = computeStats(allSections, decisionPoints.length, parsedEvidence);

  // 마커별 Map (렌더링용)
  const slotMap = new Map<ContractMarkerKind, readonly ContractSection[]>([
    ["inputs", inputs],
    ["outputs", outputs],
    ["precondition", preconditions],
    ["postcondition", postconditions],
    ["flow-steps", steps],
    ["decision-point", decisionPoints],
    ["failure", failures],
    ["evidence", evidence],
  ]);

  // 텍스트 렌더링
  const text = renderContract(group, groupPurpose, slotMap);

  return {
    group: { id: groupId, title: group.title, purpose: groupPurpose },
    inputs,
    outputs,
    preconditions,
    postconditions,
    steps,
    decisionPoints,
    failures,
    evidence,
    parsedEvidence,
    allSections,
    memberIds,
    stats,
    text,
  };
}

// 내부 함수(extractPurpose, computeStats, renderContract)는 contract-stats.ts에 분리됨
