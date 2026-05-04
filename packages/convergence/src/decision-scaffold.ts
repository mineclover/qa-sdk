// @def.boundary convergence-layer-group
/**
 * Decision 유형별 구조화 템플릿.
 *
 * alternatives와 reversalConditions를 자동 생성한다.
 * rationale은 인간이 작성한다.
 */

import { isPowerOf2, nextPowerOf2 } from "weighted-index";
import type {
  DecisionNode,
  DecisionType,
  CapacityParams,
  NewAxisParams,
  NewPrefixParams,
  DimAddParams,
  MergeParams,
  DeprecateParams,
  DecisionScaffoldParams,
} from "./dkg-types.js";

export interface ScaffoldInput {
  readonly type: DecisionType;
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly params: DecisionScaffoldParams;
  readonly rationale: string;
  readonly additionalAlternatives?: readonly string[];
  readonly additionalReversalConditions?: readonly string[];
}

/**
 * 결정 유형에 맞는 Decision 노드를 생성한다.
 * alternatives와 reversalConditions는 유형별 규칙으로 자동 생성 + 수동 추가분 병합.
 */
export function scaffoldDecision(input: ScaffoldInput): DecisionNode {
  const { autoAlternatives, autoReversalConditions, context } = generateByType(input.type, input.params);

  const alternatives = [
    ...autoAlternatives,
    ...(input.additionalAlternatives ?? []),
  ];

  const reversalConditions = [
    ...autoReversalConditions,
    ...(input.additionalReversalConditions ?? []),
  ];

  return {
    kind: "decision",
    id: input.id,
    date: input.date,
    title: input.title,
    context,
    rationale: input.rationale,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    reversalConditions: reversalConditions.length > 0 ? reversalConditions : undefined,
    lifecycle: "active",
  };
}

function generateByType(
  type: DecisionType,
  params: DecisionScaffoldParams,
): { autoAlternatives: string[]; autoReversalConditions: string[]; context: string } {
  switch (type) {
    case "capacity":
      return generateCapacity(params as CapacityParams);
    case "new-axis":
      return generateNewAxis(params as NewAxisParams);
    case "new-prefix":
      return generateNewPrefix(params as NewPrefixParams);
    case "dim-add":
      return generateDimAdd(params as DimAddParams);
    case "merge":
      return generateMerge(params as MergeParams);
    case "deprecate":
      return generateDeprecate(params as DeprecateParams);
  }
}

function generateCapacity(p: CapacityParams) {
  const usage = p.currentCapacity > 0
    ? Math.round((p.currentUsed / p.currentCapacity) * 100)
    : 0;
  const nextPow2 = nextPowerOf2(p.proposedCapacity);
  const minimal = p.currentUsed + 1;
  const doubled = p.proposedCapacity * 2;

  return {
    context: `${p.axis} axis: 현재 ${p.currentUsed}/${p.currentCapacity} 사용 중 (${usage}%). headroom ${p.currentCapacity - p.currentUsed}.`,
    autoAlternatives: [
      `${minimal} — 최소 확장. headroom 1.${!isPowerOf2(minimal) ? " 비 2의 거듭제곱." : ""}`,
      `${p.proposedCapacity} — 제안값.${isPowerOf2(p.proposedCapacity) ? " 2의 거듭제곱. bitmask 정렬 최적." : ""}`,
      ...(nextPow2 !== p.proposedCapacity ? [`${nextPow2} — 다음 2의 거듭제곱.`] : []),
      `${doubled} — 2배 확장. 사용률 ${Math.round((p.currentUsed / doubled) * 100)}%.`,
    ],
    autoReversalConditions: [
      `${p.proposedCapacity}개가 모두 사용되고 ${p.proposedCapacity + 1}번째가 필요할 때`,
      "bitmask 정렬보다 주소 밀도가 더 중요해질 때",
    ],
  };
}

function generateNewAxis(p: NewAxisParams) {
  return {
    context: `새 축 '${p.axisId}': ${p.entries.length}개 entries, capacity ${p.capacity} (headroom ${p.capacity - p.entries.length}).`,
    autoAlternatives: [
      "기존 축 재사용 — 의미적으로 대응하는 기존 축이 있는지 확인 필요",
      "축 대신 table_ref — 경우의 수가 무한하면 좌표에 넣지 않음",
      "축 대신 metadata — 좌표 인코딩 없이 부가 정보로 관리",
    ],
    autoReversalConditions: [
      "이 축이 6개월 이상 어떤 prefix에서도 사용되지 않을 때",
      "기존 축으로 의미를 충분히 표현할 수 있을 때",
    ],
  };
}

function generateNewPrefix(p: NewPrefixParams) {
  return {
    context: `새 prefix '${p.prefixId}': dims [${p.dims.join(", ")}]${p.domain ? `, domain: ${p.domain}` : ""}.`,
    autoAlternatives: [
      "기존 prefix 확장 — 기존 prefix에 차원을 추가하여 통합",
      "별도 시스템으로 관리 — 좌표 인코딩 없이 외부 서비스 사용",
    ],
    autoReversalConditions: [
      "이 prefix가 6개월 이상 어떤 consumer에서도 사용되지 않을 때",
      "기존 prefix로 동일한 주소 공간을 표현할 수 있을 때",
    ],
  };
}

function generateDimAdd(p: DimAddParams) {
  return {
    context: `prefix '${p.prefix}'에 차원 '${p.newDim}' 추가. 기본값: ${p.defaultValue ?? 1}.`,
    autoAlternatives: [
      "별도 prefix로 분리 — 기존 prefix의 주소 공간을 오염하지 않음",
      "metadata로 관리 — 좌표 인코딩 없이 부가 정보로 추적",
    ],
    autoReversalConditions: [
      "추가된 차원이 단일 값만 사용될 때 (사실상 불필요)",
      "차원 추가로 인해 주소 공간이 과도하게 커질 때",
    ],
  };
}

function generateMerge(p: MergeParams) {
  const overlap = p.overlapEntries ?? [];
  return {
    context: `${p.targets.join("과 ")} 병합 → '${p.into}'. 중복 entries: [${overlap.join(", ")}] (${overlap.length}개).`,
    autoAlternatives: [
      "병합 — entries 합집합, 기존 position 재배치 필요",
      "유지 + alias — 이름 규칙 정비로 혼동 해소",
      "유지 + constraint — 동시 사용 금지 규칙 추가",
    ],
    autoReversalConditions: [
      "병합 후 두 도메인의 의미가 다시 분기할 때",
      "병합으로 인해 prefix의 주소 공간이 과도하게 커질 때",
    ],
  };
}

function generateDeprecate(p: DeprecateParams) {
  return {
    context: `'${p.target}' 비활성화${p.replacement ? `. 대체: '${p.replacement}'` : ""}.`,
    autoAlternatives: [
      "유지 + 비활성화 — 좌표 공간은 보존하되 신규 인코딩만 차단",
      ...(p.replacement ? [] : ["대체 축/prefix 없이 완전 제거"]),
    ],
    autoReversalConditions: [
      "비활성화된 대상이 재활성화 필요할 때",
      "비활성화가 다른 prefix의 주소 해석에 영향을 줄 때",
    ],
  };
}

