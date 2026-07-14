// @def.doc definition-catalog-spec

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

import type { DefLayer, DefinitionEntry, DefinitionLink, LinkType } from './types.js';

/** 영향받는 문서 1건 */
export interface ImpactedDoc {
  /** 영향받는 문서 ID */
  readonly id: string;
  /** 영향받는 문서의 canonical address */
  readonly address?: string;
  /** 어떤 관계를 통해 영향받는가 */
  readonly via: LinkType;
  /** 영향 경로 (변경 문서 → ... → 영향받는 문서) */
  readonly path: readonly string[];
  /** 영향의 방향 */
  readonly direction: 'upstream' | 'downstream';
  /** 영향 깊이 (hop 수) */
  readonly depth: number;
  /** 영향받는 문서의 layer (있으면) */
  readonly layer?: DefLayer;
  /** layer 경계를 넘었는가 (business→binding→interaction) */
  readonly crossLayer: boolean;
}

/** 영향 분석 결과 */
export interface ImpactAnalysis {
  /** 변경된 문서 ID */
  readonly sourceId: string;
  /** 변경된 문서의 canonical address */
  readonly sourceAddress?: string;
  /** 변경 문서의 layer */
  readonly sourceLayer?: DefLayer;
  /** 영향받는 문서 목록 */
  readonly impacted: readonly ImpactedDoc[];
  /** 영향받는 그룹 (contains 역추적) */
  readonly affectedGroups: readonly string[];
  /** 영향 범위 요약: 총 영향 문서 수 */
  readonly blastRadius: number;
  /** layer별 영향 수 */
  readonly byLayer: {
    domain: number;
    operation: number;
    mediation: number;
    experience: number;
    unspecified: number;
  };
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
/**
 * 4계층 영향 전파 규칙:
 *
 * | source layer | 전파 대상 layer                    | 이유 |
 * |-------------|----------------------------------|------|
 * | domain      | domain, operation, mediation     | experience 직접 영향 없음 |
 * | operation   | operation                        | 독립 — 인프라 변경이 다른 계층에 영향 주면 안 됨 |
 * | mediation   | mediation, experience            | domain 역전파 없음 |
 * | experience  | experience                       | 상향 전파 없음 |
 * | 미지정       | 모두                              | layer 미지정은 제한 없음 (기존 호환) |
 */
function canPropagate(
  sourceLayer: DefLayer | undefined,
  targetLayer: DefLayer | undefined,
): boolean {
  if (!sourceLayer || !targetLayer) return true;

  if (sourceLayer === 'domain') {
    return targetLayer === 'domain' || targetLayer === 'operation' || targetLayer === 'mediation';
  }
  if (sourceLayer === 'operation') {
    return targetLayer === 'operation';
  }
  if (sourceLayer === 'mediation') {
    return targetLayer === 'mediation' || targetLayer === 'experience';
  }
  if (sourceLayer === 'experience') {
    return targetLayer === 'experience';
  }
  return true;
}

export function analyzeImpact(
  sourceId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: 'outgoing' | 'incoming') => readonly DefinitionLink[],
): ImpactAnalysis {
  const source = getEntry(sourceId);
  if (!source) {
    return {
      sourceId,
      impacted: [],
      affectedGroups: [],
      blastRadius: 0,
      byLayer: { domain: 0, operation: 0, mediation: 0, experience: 0, unspecified: 0 },
    };
  }

  const sourceLayer = source.layer;
  const impacted: ImpactedDoc[] = [];
  const visited = new Set<string>([sourceId]);
  const affectedGroups: string[] = [];
  const byLayer = { domain: 0, operation: 0, mediation: 0, experience: 0, unspecified: 0 };

  // BFS로 영향 전파
  const queue: {
    docId: string;
    path: string[];
    via: LinkType;
    direction: 'upstream' | 'downstream';
    depth: number;
    propagatingLayer: DefLayer | undefined;
  }[] = [];

  // 초기 영향 수집
  seedImpact(sourceId, getLinks, queue, [], 0, sourceLayer);

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard ensures queue is non-empty
    const { docId, path, via, direction, depth, propagatingLayer } = queue.shift()!;
    if (visited.has(docId)) continue;
    visited.add(docId);

    const doc = getEntry(docId);
    if (!doc) continue;

    // layer 전파 규칙 적용
    if (!canPropagate(propagatingLayer, doc.layer)) continue;

    const crossLayer = !!propagatingLayer && !!doc.layer && propagatingLayer !== doc.layer;

    impacted.push({
      id: docId,
      address: doc.serialized || undefined,
      via,
      path,
      direction,
      depth,
      layer: doc.layer,
      crossLayer,
    });

    // layer 통계
    if (doc.layer) byLayer[doc.layer]++;
    else byLayer.unspecified++;

    // contains 역추적으로 올라간 그룹 기록
    if (via === 'contains' && direction === 'upstream') {
      affectedGroups.push(docId);
    }

    // 전이적 전파: 현재 문서의 layer로 전파
    seedImpact(docId, getLinks, queue, path, depth, doc.layer ?? propagatingLayer);
  }

  return {
    sourceId,
    sourceAddress: source.serialized || undefined,
    sourceLayer,
    impacted,
    affectedGroups,
    blastRadius: impacted.length,
    byLayer,
  };
}

function seedImpact(
  docId: string,
  getLinks: (id: string, direction: 'outgoing' | 'incoming') => readonly DefinitionLink[],
  queue: {
    docId: string;
    path: string[];
    via: LinkType;
    direction: 'upstream' | 'downstream';
    depth: number;
    propagatingLayer: DefLayer | undefined;
  }[],
  basePath: string[] = [],
  baseDepth: number = 0,
  propagatingLayer: DefLayer | undefined = undefined,
): void {
  const incoming = getLinks(docId, 'incoming');
  const outgoing = getLinks(docId, 'outgoing');
  const path = [...basePath, docId];
  const depth = baseDepth + 1;

  for (const l of incoming.filter((lnk) => lnk.linkType === 'depends_on')) {
    queue.push({
      docId: l.sourceId,
      path: [...path, l.sourceId],
      via: 'depends_on',
      direction: 'downstream',
      depth,
      propagatingLayer,
    });
  }

  for (const l of incoming.filter((lnk) => lnk.linkType === 'implements')) {
    queue.push({
      docId: l.sourceId,
      path: [...path, l.sourceId],
      via: 'implements',
      direction: 'downstream',
      depth,
      propagatingLayer,
    });
  }

  for (const l of incoming.filter((lnk) => lnk.linkType === 'refines')) {
    queue.push({
      docId: l.sourceId,
      path: [...path, l.sourceId],
      via: 'refines',
      direction: 'downstream',
      depth,
      propagatingLayer,
    });
  }

  for (const l of outgoing.filter((lnk) => lnk.linkType === 'constrains')) {
    queue.push({
      docId: l.targetId,
      path: [...path, l.targetId],
      via: 'constrains',
      direction: 'downstream',
      depth,
      propagatingLayer,
    });
  }

  for (const l of incoming.filter((lnk) => lnk.linkType === 'contains')) {
    queue.push({
      docId: l.sourceId,
      path: [...path, l.sourceId],
      via: 'contains',
      direction: 'upstream',
      depth,
      propagatingLayer,
    });
  }
}

export function selectImpactContext(
  impact: ImpactAnalysis,
  mode: 'direct' | 'transitive',
): ImpactAnalysis {
  if (mode === 'transitive') {
    return impact;
  }

  const impacted = impact.impacted.filter((item) => item.depth === 1);
  const byLayer = { domain: 0, operation: 0, mediation: 0, experience: 0, unspecified: 0 };
  for (const item of impacted) {
    if (item.layer) byLayer[item.layer]++;
    else byLayer.unspecified++;
  }

  return {
    sourceId: impact.sourceId,
    sourceAddress: impact.sourceAddress,
    sourceLayer: impact.sourceLayer,
    impacted,
    affectedGroups: impacted
      .filter((item) => item.via === 'contains' && item.direction === 'upstream')
      .map((item) => item.id),
    blastRadius: impacted.length,
    byLayer,
  };
}
