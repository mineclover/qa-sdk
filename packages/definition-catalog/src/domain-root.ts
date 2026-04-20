// @def.doc definition-catalog-spec

/**
 * 도메인 루트 파생 — link 그래프에서 문서의 최상위 도메인 문서(domain_root)를 계산한다.
 *
 * Phase 0/0b/0c 시뮬레이션 결과에 따라 확정된 알고리즘(`2026-04-20-phase1-design-decision.md`).
 * Q2 Option B: refines > depends_on. owner_system은 진단 레이어.
 */

import type { DefinitionEntry, DefinitionLink, LinkType } from "./types.js";

/** 최소 registry 계약 — `deriveDomainRoot`에 필요한 접근자만 선언한다. */
export interface DomainRootRegistry {
  all(): readonly DefinitionEntry[];
  get(id: string): DefinitionEntry | undefined;
  getLinks(id: string, direction?: "outgoing" | "incoming" | "both"): readonly DefinitionLink[];
}

const MAX_DEPTH = 10;
const DOMAIN_LINK_TYPES: readonly LinkType[] = ["refines", "depends_on"];

/** 문서가 domain tier(system 또는 layout)인지 판정한다. */
export function isDomainTier(doc: DefinitionEntry | undefined | null): boolean {
  if (!doc) return false;
  return doc.tier === "system" || doc.tier === "layout";
}

function getDomainCandidateLinks(
  docId: string,
  registry: DomainRootRegistry,
): DefinitionLink[] {
  const outgoing = registry.getLinks(docId, "outgoing");
  const candidates: DefinitionLink[] = [];
  for (const link of outgoing) {
    if (link.linkType !== "refines" && link.linkType !== "depends_on") continue;
    const target = registry.get(link.targetId);
    if (!isDomainTier(target)) continue;
    candidates.push(link);
  }
  return candidates;
}

/**
 * 후보 링크들 중에서 primary 부모를 선택한다 (Q2 Option B).
 *
 * 우선순위:
 *   1) target에 추가 domain-tier 부모가 없음 (계층 상위)
 *   2) linkType: refines > depends_on
 *   3) target id localeCompare 오름차순
 */
export function selectPrimaryParent(
  candidates: readonly DefinitionLink[],
  registry: DomainRootRegistry,
): DefinitionLink {
  if (candidates.length === 0) {
    throw new Error("selectPrimaryParent: 후보가 비어 있음");
  }

  const scored = candidates.map((link) => {
    const furtherCandidates = getDomainCandidateLinks(link.targetId, registry);
    const hasNoFurther = furtherCandidates.length === 0 ? 1 : 0;
    const isRefines = link.linkType === "refines" ? 1 : 0;
    return { link, hasNoFurther, isRefines };
  });

  scored.sort((a, b) => {
    if (b.hasNoFurther !== a.hasNoFurther) return b.hasNoFurther - a.hasNoFurther;
    if (b.isRefines !== a.isRefines) return b.isRefines - a.isRefines;
    return a.link.targetId.localeCompare(b.link.targetId);
  });

  return scored[0].link;
}

/**
 * 문서의 domain root를 파생한다.
 *
 * 1. 문서가 domain tier이고 domain-tier 부모가 없으면 self
 * 2. 도메인 tier 부모로 타고 올라가며 반복 (refines > depends_on)
 * 3. visited set + depth cap 10으로 순환/과심층 방어
 * 4. 비-domain 문서이며 후보 링크가 없으면 self (호출자 validator가 경고)
 */
export function deriveDomainRoot(
  doc: DefinitionEntry,
  registry: DomainRootRegistry,
  visited: Set<string> = new Set(),
  depth: number = 0,
): string {
  if (visited.has(doc.id)) return doc.id;
  if (depth >= MAX_DEPTH) return doc.id;

  visited.add(doc.id);

  const candidates = getDomainCandidateLinks(doc.id, registry);
  if (candidates.length === 0) return doc.id;

  const primary = selectPrimaryParent(candidates, registry);
  const next = registry.get(primary.targetId);
  if (!next) return doc.id;

  return deriveDomainRoot(next, registry, visited, depth + 1);
}

/** 전체 문서에 대해 domain root를 일괄 파생한다. */
export function deriveAllDomainRoots(registry: DomainRootRegistry): Map<string, string> {
  const result = new Map<string, string>();
  for (const doc of registry.all()) {
    result.set(doc.id, deriveDomainRoot(doc, registry));
  }
  return result;
}

/** owner_system과 derive된 domain_root 사이의 정합성을 진단한다. */
export function detectOwnerRootMismatch(
  doc: DefinitionEntry,
  derivedRoot: string,
  registry: DomainRootRegistry,
): "ok" | "mismatch" | "no-owner" {
  const owner = doc.owner_system;
  if (!owner) return "no-owner";
  if (owner === derivedRoot) return "ok";

  const rootDoc = registry.get(derivedRoot);
  if (rootDoc?.owner_system && rootDoc.owner_system === owner) return "ok";

  return "mismatch";
}

export { DOMAIN_LINK_TYPES };
