// @def.doc definition-assembly

/**
 * 문서 조립 (Assembly)
 *
 * 그룹 문서의 contains/refs 관계를 따라 멤버 문서의 purpose/overview를 수집하고,
 * 하나의 구조화된 요약으로 조립한다.
 *
 * assembleFeature("gate-system")
 *   → 그룹 purpose + 멤버별 { scope, purpose, overview }
 */

import type {
  DefinitionEntry,
  DefinitionLink,
  DefScope,
  LinkType,
} from "./types.js";
import { extractByLevel, type ExtractLevel } from "./extract.js";

/** 멤버 요약 */
export interface MemberSummary {
  readonly id: string;
  readonly title: string;
  readonly scope?: DefScope;
  readonly aspect?: string;
  readonly depth?: string;
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

/** 바운더리 요약 */
export interface BoundarySummary {
  readonly id: string;
  readonly title: string;
  readonly scope?: DefScope;
  readonly aspect?: string;
  readonly depth?: string;
  readonly purpose: string | null;
  readonly overview: readonly string[];
}

/** 직접 결합 요약 */
export interface BoundaryCouplingSummary {
  readonly linkType: Extract<LinkType, "depends_on" | "constrains" | "refines">;
  readonly direction: "incoming" | "outgoing";
  readonly doc: BoundarySummary;
}

/** 바운더리 조립 결과 */
export interface AssembledBoundary {
  readonly boundary: BoundarySummary;
  readonly members: readonly BoundarySummary[];
  readonly couplings: {
    readonly incoming: readonly BoundaryCouplingSummary[];
    readonly outgoing: readonly BoundaryCouplingSummary[];
  };
  readonly text: string;
}

/** scope 표시 순서 (구조적 → 구체적) */
const SCOPE_ORDER: readonly DefScope[] = [
  "constraint", "state", "data", "feature", "flow", "interface", "ui",
];

function scopeIndex(scope?: DefScope): number {
  if (!scope) return 999;
  const idx = SCOPE_ORDER.indexOf(scope);
  return idx === -1 ? 999 : idx;
}

const DIRECT_BOUNDARY_LINKS = new Set<Extract<LinkType, "depends_on" | "constrains" | "refines">>([
  "depends_on",
  "constrains",
  "refines",
]);

const LINK_ORDER: readonly Extract<LinkType, "depends_on" | "constrains" | "refines">[] = [
  "constrains",
  "depends_on",
  "refines",
];

function linkIndex(
  linkType: Extract<LinkType, "depends_on" | "constrains" | "refines">,
): number {
  const idx = LINK_ORDER.indexOf(linkType);
  return idx === -1 ? 999 : idx;
}

function extractSummary(
  id: string,
  title: string,
  scope: DefScope | undefined,
  aspect: string | undefined,
  depth: string | undefined,
  body: string | undefined,
  level: ExtractLevel = "overview",
): BoundarySummary {
  const purpose = body ? extractByLevel(body, "purpose").text || null : null;
  const overviewSections =
    body && level !== "purpose"
      ? extractByLevel(body, "overview").sections
          .filter((section) => section.marker === "overview")
          .map((section) => section.body)
          .filter((section) => section.length > 0)
      : [];

  return {
    id,
    title,
    scope,
    aspect,
    depth,
    purpose,
    overview: overviewSections,
  };
}

function structuralLine(summary: BoundarySummary): string {
  if (summary.purpose) return summary.purpose.split("\n")[0]!.trim();
  if (summary.overview.length > 0) return summary.overview[0]!.split("\n")[0]!.trim();
  return "(요약 없음)";
}

function isDirectBoundaryLink(
  link: DefinitionLink,
): link is DefinitionLink & { linkType: Extract<LinkType, "depends_on" | "constrains" | "refines"> } {
  return DIRECT_BOUNDARY_LINKS.has(
    link.linkType as Extract<LinkType, "depends_on" | "constrains" | "refines">,
  );
}

function collectBoundaryCouplings(
  boundaryId: string,
  direction: "incoming" | "outgoing",
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
  getBody: (id: string) => string | undefined,
  level: ExtractLevel,
): BoundaryCouplingSummary[] {
  const summaries: BoundaryCouplingSummary[] = [];

  for (const link of getLinks(boundaryId, direction).filter(isDirectBoundaryLink)) {
    const adjacentId = direction === "outgoing" ? link.targetId : link.sourceId;
    const adjacent = getEntry(adjacentId);
    if (!adjacent) continue;

    summaries.push({
      linkType: link.linkType,
      direction,
      doc: extractSummary(
        adjacent.id,
        adjacent.title,
        adjacent.scope,
        adjacent.aspect,
        adjacent.depth,
        getBody(adjacent.id),
        level,
      ),
    });
  }

  return summaries.toSorted((left, right) =>
    linkIndex(left.linkType) - linkIndex(right.linkType) ||
    scopeIndex(left.doc.scope) - scopeIndex(right.doc.scope) ||
    left.doc.id.localeCompare(right.doc.id),
  );
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
  const groupOverviewSections = groupBody
    ? extractByLevel(groupBody, "overview").sections.filter(s => s.marker === "overview")
    : [];
  const groupOverview = groupOverviewSections.map(s => s.body).filter(b => b.length > 0);

  // 구조 멤버 수집. Legacy group/module은 contains를, E/C/I/S + L/P Layout/Pack은 refs를 쓴다.
  const memberLinks = getLinks(groupId, "outgoing")
    .filter(l => l.linkType === "contains" || l.linkType === "refs");
  const members: MemberSummary[] = [];

  for (const link of memberLinks) {
    const member = getEntry(link.targetId);
    if (!member) continue;

    const body = getBody(member.id);
    let purpose: string | null = null;
    let overview: string[] = [];

    if (body) {
      const purposeResult = extractByLevel(body, "purpose");
      purpose = purposeResult.text || null;

      if (level !== "purpose") {
        const overviewResult = extractByLevel(body, "overview");
        overview = overviewResult.sections
          .filter(s => s.marker === "overview")
          .map(s => s.body)
          .filter(b => b.length > 0);
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

/**
 * 바운더리 문서에서 direct 구조 + direct coupling만 조립한다.
 *
 * - 구조: outgoing contains/refs 1-hop
 * - 결합: direct incoming/outgoing depends_on/constrains/refines
 * - 세부 business logic는 포함하지 않고 purpose/overview 수준만 노출한다.
 */
export function assembleBoundary(
  boundaryId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
  getBody: (id: string) => string | undefined,
  level: ExtractLevel = "overview",
): AssembledBoundary | null {
  const boundaryEntry = getEntry(boundaryId);
  if (!boundaryEntry) return null;

  const boundary = extractSummary(
    boundaryEntry.id,
    boundaryEntry.title,
    boundaryEntry.scope,
    boundaryEntry.aspect,
    boundaryEntry.depth,
    getBody(boundaryId),
    level,
  );

  const members = getLinks(boundaryId, "outgoing")
    .filter((link) => link.linkType === "contains" || link.linkType === "refs")
    .map((link) => getEntry(link.targetId))
    .filter((entry): entry is DefinitionEntry => entry !== undefined)
    .map((entry) =>
      extractSummary(
        entry.id,
        entry.title,
        entry.scope,
        entry.aspect,
        entry.depth,
        getBody(entry.id),
        level,
      ),
    )
    .toSorted((left, right) => scopeIndex(left.scope) - scopeIndex(right.scope));

  const outgoing = collectBoundaryCouplings(
    boundaryId,
    "outgoing",
    getEntry,
    getLinks,
    getBody,
    level,
  );

  const incoming = collectBoundaryCouplings(
    boundaryId,
    "incoming",
    getEntry,
    getLinks,
    getBody,
    level,
  );

  const lines: string[] = [];
  lines.push(`# 바운더리: ${boundary.title}`);
  lines.push("");
  lines.push(`scope: ${boundary.scope}/${boundary.aspect}  depth: ${boundary.depth}`);
  if (boundary.purpose) {
    lines.push("");
    lines.push(`## 목적`);
    lines.push(boundary.purpose);
  }
  if (boundary.overview.length > 0) {
    lines.push("");
    lines.push(`## 개요`);
    for (const overview of boundary.overview) {
      lines.push(`- ${overview.split("\n")[0]!.trim()}`);
    }
  }

  lines.push("");
  lines.push(`## 구조`);
  if (members.length === 0) {
    lines.push(`- (contains 멤버 없음)`);
  } else {
    for (const member of members) {
      lines.push(
        `- [${member.scope}/${member.aspect}] ${member.id}: ${structuralLine(member)}`,
      );
    }
  }

  lines.push("");
  lines.push(`## 직접 결합`);
  lines.push(`### outgoing`);
  if (outgoing.length === 0) {
    lines.push(`- (없음)`);
  } else {
    for (const coupling of outgoing) {
      lines.push(
        `- [${coupling.linkType}] ${coupling.doc.id}: ${structuralLine(coupling.doc)}`,
      );
    }
  }

  lines.push("");
  lines.push(`### incoming`);
  if (incoming.length === 0) {
    lines.push(`- (없음)`);
  } else {
    for (const coupling of incoming) {
      lines.push(
        `- [${coupling.linkType}] ${coupling.doc.id}: ${structuralLine(coupling.doc)}`,
      );
    }
  }

  return {
    boundary,
    members,
    couplings: { incoming, outgoing },
    text: lines.join("\n"),
  };
}
