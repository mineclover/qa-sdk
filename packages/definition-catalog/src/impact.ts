/**
 * 영향 분석 (Impact Analysis)
 *
 * 바텀업 역추적: "이 문서가 변경되면 무엇이 영향받는가?"
 *
 * 프로젝트 초반에는 탑다운(시스템→컴포넌트)으로 설계하지만,
 * 후반에는 바텀업(리프 변경→상위 영향)으로 의사결정이 발생한다.
 * 이때 사이드 이펙트를 문서 그래프에서 역추적할 수 있어야 한다.
 *
 * concern 전파의 역방향:
 *   concern: "이 문서에 어떤 제약이 걸리는가?" (위→아래)
 *   impact:  "이 문서가 바뀌면 무엇이 깨지는가?" (아래→위)
 */

import type { DefinitionEntry, DefinitionLink, LinkType } from "./types.js";

/** 영향받는 문서 1건 */
export interface ImpactedDoc {
  /** 영향받는 문서 ID */
  readonly id: string;
  /** 어떤 관계를 통해 영향받는가 */
  readonly via: LinkType;
  /** 영향 경로 (변경 문서 → ... → 영향받는 문서) */
  readonly path: readonly string[];
  /** 영향의 방향 */
  readonly direction: "upstream" | "downstream";
  /** 영향 깊이 (hop 수) */
  readonly depth: number;
}

/** 영향 분석 결과 */
export interface ImpactAnalysis {
  /** 변경된 문서 ID */
  readonly sourceId: string;
  /** 영향받는 문서 목록 */
  readonly impacted: readonly ImpactedDoc[];
  /** 영향받는 그룹 (contains 역추적) */
  readonly affectedGroups: readonly string[];
  /** 영향 범위 요약: 총 영향 문서 수 */
  readonly blastRadius: number;
}

/**
 * 영향 역추적 규칙.
 *
 * link = source --linkType--> target 일 때,
 * target이 변경되면 누가 영향받는가?
 *
 * | linkType   | target 변경 시 영향받는 쪽 | 이유 |
 * |------------|--------------------------|------|
 * | depends_on | source (의존자)           | 의존 대상이 바뀌면 의존자가 깨짐 |
 * | implements | source (구현체)           | 명세가 바뀌면 구현이 불일치 |
 * | refines    | source (상세 문서)        | 상위가 바뀌면 하위가 불일치 |
 * | constrains | target (피제약자)          | 제약이 바뀌면 피제약자 재검토 |
 * | contains   | source (그룹)             | 멤버가 바뀌면 그룹 요약이 stale |
 * | traces_to  | (영향 없음)               | 추적 관계일 뿐 |
 */
export function analyzeImpact(
  sourceId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
): ImpactAnalysis {
  const source = getEntry(sourceId);
  if (!source) {
    return { sourceId, impacted: [], affectedGroups: [], blastRadius: 0 };
  }

  const impacted: ImpactedDoc[] = [];
  const visited = new Set<string>([sourceId]);
  const affectedGroups: string[] = [];

  // BFS로 영향 전파
  const queue: { docId: string; path: string[]; via: LinkType; direction: "upstream" | "downstream"; depth: number }[] = [];

  // 초기 영향 수집
  seedImpact(sourceId, getLinks, queue);

  while (queue.length > 0) {
    const { docId, path, via, direction, depth } = queue.shift()!;
    if (visited.has(docId)) continue;
    visited.add(docId);

    const doc = getEntry(docId);
    if (!doc) continue;

    impacted.push({ id: docId, via, path, direction, depth });

    // contains 역추적으로 올라간 그룹 기록
    if (via === "contains" && direction === "upstream") {
      affectedGroups.push(docId);
    }

    // 전이적 전파: 영향받는 문서에서 다시 영향 탐색
    seedImpact(docId, getLinks, queue, path, depth);
  }

  return {
    sourceId,
    impacted,
    affectedGroups,
    blastRadius: impacted.length,
  };
}

function seedImpact(
  docId: string,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
  queue: { docId: string; path: string[]; via: LinkType; direction: "upstream" | "downstream"; depth: number }[],
  basePath: string[] = [],
  baseDepth: number = 0,
): void {
  const incoming = getLinks(docId, "incoming");
  const outgoing = getLinks(docId, "outgoing");
  const path = [...basePath, docId];
  const depth = baseDepth + 1;

  // depends_on: source가 docId에 의존 → source 영향
  for (const l of incoming.filter(l => l.linkType === "depends_on")) {
    queue.push({ docId: l.sourceId, path: [...path, l.sourceId], via: "depends_on", direction: "downstream", depth });
  }

  // implements: source가 docId를 구현 → source 영향
  for (const l of incoming.filter(l => l.linkType === "implements")) {
    queue.push({ docId: l.sourceId, path: [...path, l.sourceId], via: "implements", direction: "downstream", depth });
  }

  // refines: source가 docId를 구체화 → source 영향
  for (const l of incoming.filter(l => l.linkType === "refines")) {
    queue.push({ docId: l.sourceId, path: [...path, l.sourceId], via: "refines", direction: "downstream", depth });
  }

  // constrains: docId가 target을 제약 → target 영향 (제약이 바뀌면 피제약자 재검토)
  for (const l of outgoing.filter(l => l.linkType === "constrains")) {
    queue.push({ docId: l.targetId, path: [...path, l.targetId], via: "constrains", direction: "downstream", depth });
  }

  // contains: source(그룹)가 docId를 포함 → 그룹 영향 (멤버 변경 → 그룹 요약 stale)
  for (const l of incoming.filter(l => l.linkType === "contains")) {
    queue.push({ docId: l.sourceId, path: [...path, l.sourceId], via: "contains", direction: "upstream", depth });
  }

  // traces_to: 영향 없음 — 전파하지 않음
}
