/**
 * Concern 전파 엔진 (Structural Constraint Propagation)
 *
 * concern은 단순 태그가 아니라 link 그래프를 타고 전파되는 구조적 제약이다.
 *
 * ┌─────────────────────┐
 * │ 인증 시스템 개요      │  [security 직접]
 * └─────────┬───────────┘
 *           │ refines ↓ (security 전파)
 * ┌─────────▼───────────┐
 * │ 인증 API 명세        │  [security 상속: via refines]
 * └─────────┬───────────┘
 *           │ implements ↓ (security 전파)
 * ┌─────────▼───────────┐
 * │ 로그인 컴포넌트       │  [security 상속: via implements]
 * └─────────────────────┘
 *
 * 전파 방향 규칙:
 *   link = source --linkType--> target
 *   downstream: concern이 상위→하위로 전파
 *     refines:    A --refines--> B (A가 B를 구체화). B에 concern이 있으면 A가 상속.
 *     implements: A --implements--> B (A가 B를 구현). B에 concern이 있으면 A가 상속.
 *     constrains: A --constrains--> B (A가 B를 제약). A에 concern이 있으면 B가 상속.
 *   upstream: concern이 의존 대상에서 의존자로 전파
 *     depends_on: A --depends_on--> B (A가 B에 의존). B에 concern이 있으면 A가 상속.
 */

import type {
  ConcernTag,
  ConcernDef,
  InheritedConcern,
  EffectiveConcerns,
  DefinitionEntry,
  DefinitionLink,
  LinkType,
} from "./types.js";

// ─── Concern 정의 레지스트리 ─────────────────────────────

export const CONCERN_DEFS: readonly ConcernDef[] = [
  {
    id: "security",
    name: "보안",
    description: "인증, 인가, 암호화, 감사",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
      { linkType: "depends_on", direction: "upstream" },
      { linkType: "constrains", direction: "downstream" },
    ],
  },
  {
    id: "performance",
    name: "성능",
    description: "지연, 처리량, 최적화",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
      { linkType: "depends_on", direction: "upstream" },
    ],
  },
  {
    id: "accessibility",
    name: "접근성",
    description: "a11y, WCAG, 스크린리더",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
      { linkType: "constrains", direction: "downstream" },
    ],
  },
  {
    id: "observability",
    name: "관측성",
    description: "로깅, 메트릭, 트레이싱",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
    ],
  },
  {
    id: "testing",
    name: "테스트",
    description: "검증 전략, 커버리지",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
    ],
  },
  {
    id: "migration",
    name: "마이그레이션",
    description: "스키마 변경, 데이터 이전",
    propagation: [
      { linkType: "depends_on", direction: "upstream" },
      { linkType: "refines", direction: "downstream" },
    ],
  },
  {
    id: "deprecation",
    name: "폐기",
    description: "대체 계획, 이전 가이드",
    propagation: [
      { linkType: "refines", direction: "downstream" },
      { linkType: "implements", direction: "downstream" },
      { linkType: "depends_on", direction: "upstream" },
    ],
  },
];

const CONCERN_MAP = new Map<ConcernTag, ConcernDef>(
  CONCERN_DEFS.map(d => [d.id, d]),
);

export function getConcernDef(id: ConcernTag): ConcernDef | undefined {
  return CONCERN_MAP.get(id);
}

// ─── 전파 엔진 ──────────────────────────────────────────

/** 문서의 tags에서 ConcernTag만 추출 */
export function extractDirectConcerns(entry: DefinitionEntry): readonly ConcernTag[] {
  if (!entry.tags) return [];
  return entry.tags.filter(t => CONCERN_MAP.has(t as ConcernTag)) as ConcernTag[];
}

/**
 * 대상 문서의 입장에서, 전파 규칙에 따라 concern을 줄 수 있는 이웃 문서 ID를 반환한다.
 *
 * link = source --linkType--> target 일 때:
 *
 * | linkType   | direction  | 대상이 source일 때 (outgoing)          | 대상이 target일 때 (incoming)          |
 * |------------|------------|---------------------------------------|---------------------------------------|
 * | refines    | downstream | target(=상위)에서 concern 상속         | —                                     |
 * | implements | downstream | target(=명세)에서 concern 상속         | —                                     |
 * | depends_on | upstream   | target(=의존대상)에서 concern 상속     | —                                     |
 * | constrains | downstream | —                                     | source(=제약자)에서 concern 상속       |
 */
function findConcernSources(
  targetId: string,
  linkType: LinkType,
  direction: "downstream" | "upstream",
  outgoing: readonly DefinitionLink[],
  incoming: readonly DefinitionLink[],
): readonly string[] {
  if (linkType === "constrains" && direction === "downstream") {
    // constrains는 특수: source(제약자)가 target(피제약자)에게 concern을 준다
    // 대상이 incoming constrains의 target → source가 concern 출처
    return incoming
      .filter(l => l.linkType === "constrains")
      .map(l => l.sourceId);
  }

  // 나머지: outgoing link의 target이 concern 출처
  return outgoing
    .filter(l => l.linkType === linkType)
    .map(l => l.targetId);
}

/**
 * 문서의 effective concerns를 계산한다.
 *
 * 1-hop 직접 이웃 + 다단계 전이적 전파 (BFS).
 */
export function computeEffectiveConcerns(
  targetId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinksForDoc: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
): EffectiveConcerns {
  const target = getEntry(targetId);
  if (!target) {
    return { direct: [], inherited: [], all: [] };
  }

  const direct = extractDirectConcerns(target);
  const inherited: InheritedConcern[] = [];
  const seen = new Set<string>(); // "concern:fromDocId" 중복 방지

  for (const concernDef of CONCERN_DEFS) {
    // BFS로 전파 경로 탐색
    const queue: { docId: string; path: string[]; viaLinkType: LinkType }[] = [];
    const visited = new Set<string>([targetId]);

    // 초기 이웃 탐색
    const outgoing = getLinksForDoc(targetId, "outgoing");
    const incoming = getLinksForDoc(targetId, "incoming");

    for (const rule of concernDef.propagation) {
      const sources = findConcernSources(targetId, rule.linkType, rule.direction, outgoing, incoming);
      for (const srcId of sources) {
        if (!visited.has(srcId)) {
          queue.push({ docId: srcId, path: [targetId, srcId], viaLinkType: rule.linkType });
        }
      }
    }

    // BFS
    while (queue.length > 0) {
      const { docId, path, viaLinkType } = queue.shift()!;
      if (visited.has(docId)) continue;
      visited.add(docId);

      const doc = getEntry(docId);
      if (!doc) continue;

      // 이 문서에 해당 concern이 직접 부여되어 있는가?
      const docConcerns = extractDirectConcerns(doc);
      if (docConcerns.includes(concernDef.id)) {
        const key = `${concernDef.id}:${docId}`;
        if (!seen.has(key)) {
          seen.add(key);
          inherited.push({
            concern: concernDef.id,
            from: docId,
            via: viaLinkType,
            path,
          });
        }
      }

      // 전이적 탐색: 이 문서에서 더 위로 올라갈 수 있는가?
      const nextOutgoing = getLinksForDoc(docId, "outgoing");
      const nextIncoming = getLinksForDoc(docId, "incoming");

      for (const rule of concernDef.propagation) {
        const nextSources = findConcernSources(docId, rule.linkType, rule.direction, nextOutgoing, nextIncoming);
        for (const srcId of nextSources) {
          if (!visited.has(srcId)) {
            queue.push({ docId: srcId, path: [...path, srcId], viaLinkType: rule.linkType });
          }
        }
      }
    }
  }

  const allConcerns = [...new Set([...direct, ...inherited.map(i => i.concern)])];
  return { direct, inherited, all: allConcerns };
}
