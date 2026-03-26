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
import { findMarkedSections, type MarkedSection } from "./extract.js";
import { CONTRACT_MARKERS, type ContractMarkerKind, type ContractMarkerDef } from "./taxonomy.js";

// ─── 가역성 (Reversibility) ─────────────────────────────

/**
 * 관측 가역성.
 *
 * 로그/트레이스/증거가 원본 데이터를 복원할 수 있는지 여부.
 * - reversible: 로그 + 로직 → 원본 데이터 복원 가능 (이벤트 소싱, raw event log)
 * - irreversible: 정보 손실로 원본 복원 불가 (집계 메트릭, verdict 판정)
 *
 * 정보이론적으로 reversible = 무손실(entropy 보존), irreversible = 손실(entropy 감소).
 * 마스킹된 데이터는 가역이더라도 비가역으로 전환된다.
 *
 * evidence 마커 내부에서 [reversible] / [irreversible] 어노테이션으로 선언한다:
 *
 * ```markdown
 * ## 증거 요구 ^evidence
 *
 * - 입력 정규화 로그 [reversible]
 * - 재고 검증 결과 [reversible]
 * - 최종 verdict 판정 [irreversible]
 * - 처리 시간 (어노테이션 없으면 미지정)
 * ```
 */
export type Reversibility = "reversible" | "irreversible";

/** 파싱된 증거 항목 — 가역성 어노테이션 포함 */
export interface EvidenceItem {
  /** 항목 설명 (어노테이션 제거 후) */
  readonly description: string;
  /** 가역성 — 어노테이션이 없으면 null (미지정) */
  readonly reversibility: Reversibility | null;
  /** 원본 문서 ID */
  readonly sourceId: string;
  /** 원본 텍스트 (어노테이션 포함) */
  readonly raw: string;
}

/** [reversible] 또는 [irreversible] 어노테이션 정규식 */
const REVERSIBILITY_REGEX = /\s*\[(reversible|irreversible)\]\s*$/;

/**
 * evidence 섹션 본문에서 증거 항목을 파싱한다.
 * 불릿 항목(-/*)에서 [reversible]/[irreversible] 어노테이션을 추출한다.
 */
export function parseEvidenceItems(body: string, sourceId: string): readonly EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const line of body.split("\n")) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (!bulletMatch) continue;

    const raw = bulletMatch[1].trim();
    const revMatch = raw.match(REVERSIBILITY_REGEX);

    if (revMatch) {
      items.push({
        description: raw.replace(REVERSIBILITY_REGEX, "").trim(),
        reversibility: revMatch[1] as Reversibility,
        sourceId,
        raw,
      });
    } else {
      items.push({
        description: raw,
        reversibility: null,
        sourceId,
        raw,
      });
    }
  }
  return items;
}

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

/** 계약 통계 — MAP-Elites archive 축으로 사용 가능 */
export interface ContractStats {
  /** 전체 섹션 수 */
  readonly totalSections: number;
  /** code mode 섹션 수 */
  readonly codeSections: number;
  /** llm mode 섹션 수 */
  readonly llmSections: number;
  /** 의미 밀도 (llm / total) — HyEvo의 reasoning density에 대응 */
  readonly semanticDensity: number;
  /** 검증 밀도 (evidence + postcondition / total) */
  readonly validationDensity: number;
  /** 분기 수 */
  readonly branchingFactor: number;
  /** 계약 완성도 (8종 마커 중 몇 종이 존재하는가) */
  readonly completeness: number;
  /** 증거 가역성 비율 (reversible / 전체 증거 항목) — 높을수록 데이터 복원 가능성 높음 */
  readonly evidenceReversibilityRatio: number;
}

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

// ─── 내부 함수 ──────────────────────────────────────────

function extractPurpose(body: string): string | null {
  const sections = findMarkedSections(body);
  const purposeSections = sections.filter(s => s.marker === "purpose");
  if (purposeSections.length === 0) return null;
  return purposeSections.map(s => s.body).join("\n\n");
}

function computeStats(
  sections: readonly ContractSection[],
  branchingFactor: number,
  parsedEvidence: readonly EvidenceItem[],
): ContractStats {
  const total = sections.length;
  const codeSections = sections.filter(s => s.markerDef.modeHint === "code").length;
  const llmSections = sections.filter(s => s.markerDef.modeHint === "llm").length;
  const validationSections = sections.filter(
    s => s.marker === "evidence" || s.marker === "postcondition",
  ).length;

  // 8종 마커 중 몇 종이 존재하는가
  const presentMarkers = new Set(sections.map(s => s.marker));
  const completeness = presentMarkers.size / CONTRACT_MARKERS.length;

  // 증거 가역성 비율
  const reversibleCount = parsedEvidence.filter(e => e.reversibility === "reversible").length;
  const evidenceReversibilityRatio = parsedEvidence.length > 0
    ? reversibleCount / parsedEvidence.length
    : 0;

  return {
    totalSections: total,
    codeSections,
    llmSections,
    semanticDensity: total > 0 ? llmSections / total : 0,
    validationDensity: total > 0 ? validationSections / total : 0,
    branchingFactor,
    completeness,
    evidenceReversibilityRatio,
  };
}

/** 계약 섹션 한국어 레이블 */
const SLOT_LABELS: Record<ContractMarkerKind, string> = {
  "inputs": "입력",
  "outputs": "출력",
  "precondition": "사전 조건",
  "postcondition": "사후 조건",
  "flow-steps": "실행 단계",
  "decision-point": "분기 지점",
  "failure": "실패 조건",
  "evidence": "증거 요구",
};

/** 렌더링 순서 (HyEvo workflow topology 순서: guard → boundary → steps → branch → verify) */
const RENDER_ORDER: readonly ContractMarkerKind[] = [
  "precondition",
  "inputs",
  "outputs",
  "flow-steps",
  "decision-point",
  "failure",
  "postcondition",
  "evidence",
];

function renderContract(
  group: DefinitionEntry,
  purpose: string | null,
  slotMap: Map<ContractMarkerKind, readonly ContractSection[]>,
): string {
  const lines: string[] = [];

  lines.push(`# ${group.title} — 계약`);
  if (purpose) lines.push(`\n${purpose}`);
  lines.push("");

  for (const marker of RENDER_ORDER) {
    const sections = slotMap.get(marker) ?? [];
    if (sections.length === 0) continue;

    lines.push(`## ${SLOT_LABELS[marker]} (${sections.length}건)`);
    for (const s of sections) {
      lines.push(`### [${s.sourceScope}] ${s.sourceId}`);
      lines.push(s.body);
      lines.push("");
    }
  }

  return lines.join("\n");
}
