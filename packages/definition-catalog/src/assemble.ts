/**
 * 문서 조립 (Assembly)
 *
 * 그룹 문서의 contains 관계를 따라 멤버 문서의 purpose/overview를 수집하고,
 * 하나의 구조화된 요약으로 조립한다.
 *
 * assembleFeature("gate-system")
 *   → 그룹 purpose + 멤버별 { scope, purpose, overview }
 */

import type { DefinitionEntry, DefinitionLink, DefScope } from "./types.js";
import { extractByLevel, type ExtractLevel } from "./extract.js";

/** 멤버 요약 */
export interface MemberSummary {
  readonly id: string;
  readonly title: string;
  readonly scope: DefScope;
  readonly aspect: string;
  readonly depth: string;
  readonly purpose: string | null;
  readonly overview: readonly string[];
}

/** 조립 결과 */
export interface AssembledFeature {
  /** 그룹 문서 정보 */
  readonly group: {
    readonly id: string;
    readonly title: string;
    readonly purpose: string | null;
    readonly overview: readonly string[];
  };
  /** 멤버 요약 (scope별 정렬) */
  readonly members: readonly MemberSummary[];
  /** concern 요약 (그룹에 직접 부여된 tags) */
  readonly concerns: readonly string[];
  /** 텍스트 렌더링 */
  readonly text: string;
}

/** scope 표시 순서 (구조적 → 구체적) */
const SCOPE_ORDER: readonly DefScope[] = [
  "constraint", "state", "data", "feature", "flow", "interface", "ui",
];

function scopeIndex(scope: DefScope): number {
  const idx = SCOPE_ORDER.indexOf(scope);
  return idx === -1 ? 999 : idx;
}

/**
 * 그룹 문서에서 멤버를 조립한다.
 *
 * @param groupId 그룹 문서 ID
 * @param getEntry 문서 조회
 * @param getLinks 관계 조회
 * @param getBody 본문 조회 (ID → markdown body)
 * @param level 추출 수준 (기본: "overview")
 */
export function assembleFeature(
  groupId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
  getBody: (id: string) => string | undefined,
  level: ExtractLevel = "overview",
): AssembledFeature | null {
  const group = getEntry(groupId);
  if (!group) return null;

  // 그룹 본문에서 purpose/overview 추출
  const groupBody = getBody(groupId);
  const groupPurpose = groupBody ? extractByLevel(groupBody, "purpose").text || null : null;
  const groupOverview = groupBody ? extractByLevel(groupBody, "overview").lines.filter(l => l.length > 0) : [];

  // contains 멤버 수집
  const containsLinks = getLinks(groupId, "outgoing").filter(l => l.linkType === "contains");
  const members: MemberSummary[] = [];

  for (const link of containsLinks) {
    const member = getEntry(link.targetId);
    if (!member) continue;

    const body = getBody(member.id);
    let purpose: string | null = null;
    let overview: string[] = [];

    if (body) {
      const extracted = extractByLevel(body, level);
      if (level === "purpose") {
        purpose = extracted.text || null;
      } else {
        // overview에서 purpose 줄과 overview 줄을 분리
        const purposeResult = extractByLevel(body, "purpose");
        purpose = purposeResult.text || null;
        overview = extracted.lines.filter(l => l.length > 0 && l !== purpose);
      }
    }

    members.push({
      id: member.id,
      title: member.title,
      scope: member.scope,
      aspect: member.aspect,
      depth: member.depth,
      purpose,
      overview,
    });
  }

  // scope별 정렬
  members.sort((a, b) => scopeIndex(a.scope) - scopeIndex(b.scope));

  // concerns
  const concerns = (group.tags ?? []).filter(t =>
    ["security", "performance", "accessibility", "observability", "testing", "migration", "deprecation"].includes(t),
  );

  // 텍스트 렌더링
  const lines: string[] = [];
  lines.push(`# ${group.title}`);
  if (groupPurpose) lines.push(`\n${groupPurpose}`);
  if (concerns.length > 0) lines.push(`\nconcerns: ${concerns.join(", ")}`);
  lines.push("");

  for (const m of members) {
    lines.push(`## [${m.scope}] ${m.title}`);
    if (m.purpose) lines.push(m.purpose);
    for (const o of m.overview) lines.push(`  ${o}`);
    lines.push("");
  }

  return {
    group: { id: groupId, title: group.title, purpose: groupPurpose, overview: groupOverview },
    members,
    concerns,
    text: lines.join("\n"),
  };
}
