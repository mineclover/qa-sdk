---
def:
  tier: component
  id: dkg-skill-decision
  address: def_document:v2:68766
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [decision]
  links:
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-node-types
      type: depends_on
sources:
  - packages/dkg/src/decision-scaffold.ts
  - packages/dkg/src/skills/decision-scaffold.ts
  - packages/dkg/src/skills/skill-chain.ts
  - packages/dkg/src/skills/record-operation.ts
  - packages/dkg/src/skills/converge-chain.ts
  - packages/dkg/src/dkg.test.ts
  - packages/dkg/src/skills/record-operation.test.ts
  - packages/cli/src/commands/dkg.ts
---
# Decision.scaffold — 의사결정 템플릿


## 탐색 ^navigation

dkg-system > dkg-skills-system > **dkg-skill-decision**

형제: `dkg-skill-cascade` · `dkg-skill-migrator` · `dkg-skill-version-event` · `dkg-skill-catalog`

## 목적 ^purpose

구조화된 의사결정 문서를 자동 생성하는 skill. 유형별 context, alternatives, reversalConditions를 자동 생성하고, rationale은 인간이 작성한다.

## 구성 ^overview

6종 의사결정 유형(`capacity`, `new-axis`, `new-prefix`, `dim-add`, `merge`, `deprecate`), 유형별 템플릿 생성 로직, DecisionNode 출력으로 구성된다.

## 입력 타입

소스 위치: `packages/dkg/src/decision-scaffold.ts`

```typescript
interface ScaffoldInput {
  readonly type: DecisionType;
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly params: DecisionScaffoldParams;
  readonly rationale: string;
  readonly additionalAlternatives?: readonly string[];
  readonly additionalReversalConditions?: readonly string[];
}
```

## 6종 의사결정 유형

### capacity — 축 용량 확장

입력: `CapacityParams { axis, currentUsed, currentCapacity, proposedCapacity }`

자동 생성:
- **context**: 현재 사용률, headroom 표시
- **alternatives**: 최소 확장, 제안값, 다음 2의 거듭제곱, 2배 확장
- **reversalConditions**: 제안 용량 소진 시, bitmask 정렬보다 밀도가 중요해질 때

`isPowerOf2()`와 `nextPowerOf2()`를 사용하여 2의 거듭제곱 정렬을 안내한다.

### new-axis — 새 축 신설

입력: `NewAxisParams { axisId, entries, capacity }`

자동 생성:
- **context**: 축 이름, entries 수, capacity, headroom
- **alternatives**: 기존 축 재사용, table_ref로 대체, metadata로 관리
- **reversalConditions**: 6개월 이상 미사용 시, 기존 축으로 표현 가능 시

### new-prefix — 새 prefix 신설

입력: `NewPrefixParams { prefixId, dims, domain? }`

자동 생성:
- **context**: prefix 이름, dims 목록, domain
- **alternatives**: 기존 prefix 확장, 별도 시스템으로 관리
- **reversalConditions**: 6개월 이상 미사용 시, 기존 prefix로 동일 공간 표현 가능 시

### dim-add — 차원 추가

입력: `DimAddParams { prefix, newDim, defaultValue? }`

자동 생성:
- **context**: prefix에 차원 추가, 기본값
- **alternatives**: 별도 prefix로 분리, metadata로 관리
- **reversalConditions**: 단일 값만 사용될 때, 주소 공간 과도 시

### merge — 축/prefix 병합

입력: `MergeParams { targets, into, overlapEntries? }`

자동 생성:
- **context**: 병합 대상, 중복 entries 수
- **alternatives**: entries 합집합 병합, alias 정비, constraint 추가
- **reversalConditions**: 의미 재분기 시, 주소 공간 과도 시

### deprecate — 비활성화

입력: `DeprecateParams { target, replacement? }`

자동 생성:
- **context**: 비활성화 대상, 대체 노드
- **alternatives**: 좌표 보존 + 인코딩 차단, 완전 제거
- **reversalConditions**: 재활성화 필요 시, 다른 prefix에 영향 시

## 출력

`scaffoldDecision()`은 `DecisionNode`를 반환한다.

```typescript
interface DecisionNode {
  readonly kind: "decision";
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly context: string;           // 자동 생성
  readonly rationale: string;         // 인간 작성
  readonly alternatives?: string[];   // 자동 + 수동 병합
  readonly reversalConditions?: string[]; // 자동 + 수동 병합
  readonly lifecycle: "active";       // 항상 active로 시작
}
```

## Skill Chain 연계

`scaffoldDecision()`은 주로 skill chain에서 자동 호출된다.

### entryAddChain에서의 사용

```
safeEntryAdd (verdict: "needs-capacity")
  → scaffoldDecision({ type: "capacity", ... })
  → capacity 확장 Decision 자동 생성
```

### bootstrapDkg에서의 사용

- Headroom Decision: `applyHeadroomDecisions()`가 headroom 위험 축에 대해 자동 생성
- DSL 버전 스큐 Decision: severity에 따라 "격차 수용" 또는 "정렬 필요" Decision 생성
- 분리 유지 Decision: `recordSeparation()`이 축/prefix 중복 시 분리 유지 근거 Decision 생성

### convergeChain에서의 사용

- 축 overlap 병합 후보: `scaffoldDecision({ type: "merge", ... })`

## 설계 원칙

- alternatives와 reversalConditions는 **자동 생성 + 수동 추가분 병합** — `additionalAlternatives`, `additionalReversalConditions` 파라미터
- rationale은 항상 인간이 작성한다 — 자동 생성하지 않음
- Decision은 항상 `lifecycle: "active"`로 시작 — 이후 `transitionDecision()`으로 전이
- `weighted-index`의 `isPowerOf2()`/`nextPowerOf2()` 사용으로 capacity 관련 안내를 정확하게 생성
