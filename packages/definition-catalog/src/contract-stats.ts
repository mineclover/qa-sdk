// @def.doc definition-catalog-spec

/**
 * 계약 통계 + 렌더링 — 순수 계산 + 텍스트 생성.
 *
 * contract.ts에서 추출 — 독립 테스트 가능한 계산 로직.
 */

import type { DefinitionEntry } from "./types.js";
import type { ContractMarkerKind } from "./taxonomy.js";
import { CONTRACT_MARKERS } from "./taxonomy.js";
import { findMarkedSections } from "./extract.js";
import type { EvidenceItem } from "./contract-evidence.js";

/** 계약 섹션 최소 인터페이스 (contract.ts의 ContractSection에서 필요한 부분만) */
interface StatsSection {
  readonly marker: ContractMarkerKind;
  readonly markerDef: { readonly modeHint: "code" | "llm" | "mixed" };
  readonly sourceScope?: string;
  readonly sourceId: string;
  readonly body: string;
}

/** 계약 통계 */
export interface ContractStats {
  readonly totalSections: number;
  readonly codeSections: number;
  readonly llmSections: number;
  readonly semanticDensity: number;
  readonly validationDensity: number;
  readonly branchingFactor: number;
  readonly completeness: number;
  readonly evidenceReversibilityRatio: number;
}

export function computeStats(
  sections: readonly StatsSection[],
  branchingFactor: number,
  parsedEvidence: readonly EvidenceItem[],
): ContractStats {
  const total = sections.length;
  const codeSections = sections.filter(s => s.markerDef.modeHint === "code").length;
  const llmSections = sections.filter(s => s.markerDef.modeHint === "llm").length;
  const validationSections = sections.filter(
    s => s.marker === "evidence" || s.marker === "postcondition",
  ).length;

  const presentMarkers = new Set(sections.map(s => s.marker));
  const completeness = presentMarkers.size / CONTRACT_MARKERS.length;

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

/** purpose 섹션 추출 */
export function extractPurpose(body: string): string | null {
  const sections = findMarkedSections(body);
  const purposeSections = sections.filter(s => s.marker === "purpose");
  if (purposeSections.length === 0) return null;
  return purposeSections.map(s => s.body).join("\n\n");
}

/** 계약 섹션 한국어 레이블 */
export const SLOT_LABELS: Record<ContractMarkerKind, string> = {
  "inputs": "입력",
  "outputs": "출력",
  "precondition": "사전 조건",
  "postcondition": "사후 조건",
  "flow-steps": "실행 단계",
  "decision-point": "분기 지점",
  "failure": "실패 조건",
  "evidence": "증거 요구",
};

/** 렌더링 순서 */
export const RENDER_ORDER: readonly ContractMarkerKind[] = [
  "precondition",
  "inputs",
  "outputs",
  "flow-steps",
  "decision-point",
  "failure",
  "postcondition",
  "evidence",
];

/** 계약을 마크다운 문자열로 렌더링 */
export function renderContract(
  group: DefinitionEntry,
  purpose: string | null,
  slotMap: Map<ContractMarkerKind, readonly StatsSection[]>,
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
