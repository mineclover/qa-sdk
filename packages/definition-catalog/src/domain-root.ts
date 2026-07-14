// @def.doc definition-catalog-spec

/**
 * 도메인 루트 파생 — link 그래프에서 문서의 최상위 도메인 문서(domain_root)를 계산한다.
 *
 * Phase 0/0b/0c 시뮬레이션 결과에 따라 확정된 알고리즘(`2026-04-20-phase1-design-decision.md`).
 * Q2 Option B: refines > depends_on. owner_system은 진단 레이어.
 *
 * Phase 1 확장 — sub-doc rollup (`2026-04-21-subdoc-rollup-simulation.md`):
 * 기존 walk 결과가 self 인 `tier: component` sub-doc(.todo/.plan/.memo/.test/.cases/.rule)
 * 에 한해 Hybrid D > A > C 전략으로 domain root 를 다시 탐색한다.
 *   D: id-prefix 매칭 — `foo-todo` → `foo` 탐색 (+ `-system`, `-spec` fallback)
 *   A: contains-inverse — 이 문서를 `contains` 하는 부모 문서로 위임
 *   C: file co-location — `foo.todo.md` → 같은 디렉토리의 `foo.spec.md` | `foo.md`
 * Strategy B (traces_to walk) 는 과도흡수 + backward compat 위반으로 의도적 거부.
 * 비-sub-doc 문서의 rollup 경로는 전혀 건드리지 않는다.
 */

import type { DefinitionEntry, DefinitionLink, LinkType } from './types.js';

/** 최소 registry 계약 — `deriveDomainRoot`에 필요한 접근자만 선언한다. */
export interface DomainRootRegistry {
  all(): readonly DefinitionEntry[];
  get(id: string): DefinitionEntry | undefined;
  getLinks(id: string, direction?: 'outgoing' | 'incoming' | 'both'): readonly DefinitionLink[];
}

const MAX_DEPTH = 10;
const DOMAIN_LINK_TYPES: readonly LinkType[] = ['refines', 'depends_on'];

/**
 * Sub-document 확장자 목록.
 *
 * `.spec.md` 는 일반 spec — sub-doc 이 아님. 여기에 등재된 확장자로 끝나는 파일은
 * 대응하는 부모 spec/group 을 찾아 rollup 을 위임해야 한다.
 */
export const SUB_DOC_EXTENSIONS: readonly string[] = [
  '.todo.md',
  '.plan.md',
  '.memo.md',
  '.test.md',
  '.cases.md',
  '.rule.md',
];

/** Sub-doc id 접미사 (Strategy D 용). 확장자 목록에서 자동 파생. */
const SUB_DOC_ID_SUFFIXES: readonly string[] = SUB_DOC_EXTENSIONS.map(
  (ext) => `-${ext.slice(1, -3)}`, // ".todo.md" → "-todo"
);

/** Strategy D fallback 접미사 — baseId 에 붙여 재탐색. */
const SUB_DOC_FALLBACK_SUFFIXES: readonly string[] = ['', '-system', '-spec'];

/** 문서 ref(source_path) 가 sub-doc 확장자로 끝나는지 판정. */
function isSubDocRef(ref: string | undefined): boolean {
  if (!ref) return false;
  return SUB_DOC_EXTENSIONS.some((ext) => ref.endsWith(ext));
}

/** ref 에서 sub-doc 확장자(`.todo.md` 등) 를 추출. 매칭 안 되면 null. */
function matchSubDocExtension(ref: string | undefined): string | null {
  if (!ref) return null;
  for (const ext of SUB_DOC_EXTENSIONS) {
    if (ref.endsWith(ext)) return ext;
  }
  return null;
}

/** 문서가 domain tier(system 또는 layout)인지 판정한다. */
export function isDomainTier(doc: DefinitionEntry | undefined | null): boolean {
  if (!doc) return false;
  return doc.tier === 'system' || doc.tier === 'layout';
}

function getDomainCandidateLinks(docId: string, registry: DomainRootRegistry): DefinitionLink[] {
  const outgoing = registry.getLinks(docId, 'outgoing');
  const candidates: DefinitionLink[] = [];
  for (const link of outgoing) {
    if (link.linkType !== 'refines' && link.linkType !== 'depends_on') continue;
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
    throw new Error('selectPrimaryParent: 후보가 비어 있음');
  }

  const scored = candidates.map((link) => {
    const furtherCandidates = getDomainCandidateLinks(link.targetId, registry);
    const hasNoFurther = furtherCandidates.length === 0 ? 1 : 0;
    const isRefines = link.linkType === 'refines' ? 1 : 0;
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
 * 5. self 로 떨어진 component sub-doc (`.todo.md` 등) 은 Hybrid D>A>C 로
 *    부모를 재탐색 (`deriveSubDocRoot`).
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
  if (candidates.length > 0) {
    const primary = selectPrimaryParent(candidates, registry);
    const next = registry.get(primary.targetId);
    if (!next) return doc.id;
    return deriveDomainRoot(next, registry, visited, depth + 1);
  }

  // 기본 walk 가 self 로 귀결한 경우에 한해 sub-doc rollup 시도.
  // 비-component tier 이거나 sub-doc 이 아니면 즉시 self 반환 — backward compat.
  if (doc.tier !== 'component') return doc.id;
  if (!isSubDocRef(doc.ref)) return doc.id;

  const rolled = deriveSubDocRoot(doc, registry, visited, depth);
  return rolled ?? doc.id;
}

/**
 * Sub-doc 전용 rollup — Hybrid D > A > C.
 *
 * `deriveDomainRoot` 가 self 로 귀결한 component sub-doc 에 대해서만 호출된다.
 * 반환값이 null 이면 호출자가 self 로 처리.
 *
 * 반복 호출은 `deriveDomainRoot` 로 위임하므로 visited/depth cap 가 함께 적용된다.
 */
export function deriveSubDocRoot(
  doc: DefinitionEntry,
  registry: DomainRootRegistry,
  visited: Set<string> = new Set([doc.id]),
  depth: number = 0,
): string | null {
  // Strategy D — id 접미 매칭 (가장 결정적, coverage 1등).
  const baseId = stripSubDocIdSuffix(doc.id);
  if (baseId) {
    for (const suf of SUB_DOC_FALLBACK_SUFFIXES) {
      const candidateId = baseId + suf;
      if (candidateId === doc.id) continue;
      const parent = registry.get(candidateId);
      if (!parent) continue;
      const root = deriveDomainRoot(parent, registry, visited, depth + 1);
      if (root !== doc.id) return root;
    }
  }

  // Strategy A — contains-inverse: 이 문서를 `contains` 하는 부모로 위임.
  const containerParents = collectContainsParents(doc.id, registry);
  if (containerParents.length > 0) {
    const primary = selectSubDocParent(containerParents);
    const root = deriveDomainRoot(primary, registry, visited, depth + 1);
    if (root !== doc.id) return root;
  }

  // Strategy C — file co-location: `foo.todo.md` → 같은 디렉토리의 `foo.spec.md` | `foo.md`.
  const sibling = findCoLocatedSpec(doc, registry);
  if (sibling) {
    const root = deriveDomainRoot(sibling, registry, visited, depth + 1);
    if (root !== doc.id) return root;
  }

  return null;
}

/**
 * id 가 sub-doc 접미(`-todo`, `-plan`, ...) 로 끝나면 접미를 제거해 base id 반환.
 * 복수 접미가 겹치면 (e.g. `-test-cases`) 가장 긴 매칭 우선 — 현재 목록에서는 유일.
 */
function stripSubDocIdSuffix(id: string): string | null {
  let best: string | null = null;
  for (const suf of SUB_DOC_ID_SUFFIXES) {
    if (!id.endsWith(suf)) continue;
    const stripped = id.slice(0, -suf.length);
    if (!stripped) continue;
    if (best === null || suf.length > id.length - best.length) {
      best = stripped;
    }
  }
  return best;
}

/** Strategy A — 이 문서를 `contains` 하는 부모 DefinitionEntry 목록. */
function collectContainsParents(docId: string, registry: DomainRootRegistry): DefinitionEntry[] {
  const incoming = registry.getLinks(docId, 'incoming');
  const parents: DefinitionEntry[] = [];
  for (const link of incoming) {
    if (link.linkType !== 'contains') continue;
    const parent = registry.get(link.sourceId);
    if (parent) parents.push(parent);
  }
  return parents;
}

/**
 * Strategy A tiebreak — system tier 우선, 그 다음 layout, 그 외 순으로, 마지막에 id 오름차순.
 * 동률이면 deterministic 하도록 localeCompare.
 */
function selectSubDocParent(parents: readonly DefinitionEntry[]): DefinitionEntry {
  const tierRank = (doc: DefinitionEntry): number => {
    if (doc.tier === 'system') return 0;
    if (doc.tier === 'layout') return 1;
    return 2;
  };
  return [...parents].toSorted((a, b) => {
    const ta = tierRank(a);
    const tb = tierRank(b);
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Strategy C — `foo.todo.md` 와 같은 디렉토리의 `foo.spec.md` 또는 `foo.md` 찾기.
 * 발견 못하면 null.
 *
 * DefinitionEntry 의 `ref` 필드에 파일 경로가 저장되어 있다고 가정한다
 * (`registry-helpers.ts#docRowToRegistryInput` 참조).
 */
function findCoLocatedSpec(
  doc: DefinitionEntry,
  registry: DomainRootRegistry,
): DefinitionEntry | null {
  const ref = doc.ref;
  if (!ref) return null;
  const ext = matchSubDocExtension(ref);
  if (!ext) return null;
  const stem = ref.slice(0, -ext.length); // "a/b/foo.todo.md" → "a/b/foo"
  const candidates: readonly string[] = [`${stem}.spec.md`, `${stem}.md`];
  let bestId: string | null = null;
  for (const candidatePath of candidates) {
    for (const entry of registry.all()) {
      if (entry.id === doc.id) continue;
      if (entry.ref !== candidatePath) continue;
      // 형제도 sub-doc 이면 skip (체인 피하기).
      if (isSubDocRef(entry.ref)) continue;
      // 복수 후보가 있으면 id 오름차순으로 결정적 선택.
      if (bestId === null || entry.id.localeCompare(bestId) < 0) {
        bestId = entry.id;
      }
    }
    if (bestId !== null) return registry.get(bestId) ?? null;
  }
  return null;
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
): 'ok' | 'mismatch' | 'no-owner' {
  const owner = doc.owner_system;
  if (!owner) return 'no-owner';
  if (owner === derivedRoot) return 'ok';

  const rootDoc = registry.get(derivedRoot);
  if (rootDoc?.owner_system && rootDoc.owner_system === owner) return 'ok';

  return 'mismatch';
}

export { DOMAIN_LINK_TYPES };
