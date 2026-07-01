---
def:
  tier: layout
  id: coord-semantic-indexing-pack
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: draft
  layer: domain
  tags: [semantic, taxonomy, transition, coordinate, cross-scope]
  links:
    - target: coord-semantic-indexing-logic
      type: refs
    - target: taxonomy-boundaries
      type: refs
    - target: definition-taxonomy
      type: refs
    - target: operational-ontology-taxonomy-schema
      type: refs
    - target: operational-ontology-traversal-coordinate
      type: refs
    - target: spec-transition
      type: refs
    - target: analysis-transition
      type: refs
    - target: schema-layer-spec
      type: refs
    - target: index-meta-system
      type: refs
  sources:
    - packages/spec-core/src/semantic-indexing-pack/index.ts
    - packages/spec-core/src/semantic-indexing-pack/types.ts
    - packages/spec-core/src/semantic-indexing-pack/manifest.ts
    - packages/spec-core/src/semantic-indexing-pack/classify.ts
    - packages/spec-core/src/semantic-indexing-pack/compatibility.ts
    - packages/spec-core/src/semantic-indexing-pack/proposal.ts
    - packages/spec-core/src/semantic-indexing-pack/sort.ts
    - packages/spec-core/src/semantic-indexing-pack/report.ts
    - packages/spec-core/src/semantic-indexing-pack/grounding.ts
    - packages/spec-core/src/semantic-indexing-pack/semantic-indexing-pack.test.ts
    - packages/cli/src/commands/spec.ts:runSpecSemanticPackReport
    - packages/cli/src/command-groups/spec.commands.ts
    - packages/cli/src/commands/spec-semantic-pack.test.ts
    - packages/definition-service/src/core/semantic-grounding/types.ts:SemanticGroundingRuntimeSnapshot
    - packages/definition-service/src/stores/semantic-grounding-store.ts:SqlSemanticGroundingStore
    - packages/definition-service/src/stores/semantic-grounding-store.test.ts
    - packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts:SemanticGroundingService
    - packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts
---

# Semantic Indexing Pack — 의미론 인덱싱 묶음 단위

## 목적 ^purpose

`foundation-semantic-indexing-logic`가 정의한 semantic extraction → canonical label/alias/entity/relation → 5Q axis decision → prefix/version/address → materialized index → grounding → feedback 루프를 하나의 검토, 배포, 호환성 판단 단위로 묶는다.

이 문서는 behavior를 직접 소유하지 않는 Layout/Pack 문서다. 개별 실행 책임은 taxonomy, transition, coordinate, materialization 시스템에 남기고, 어떤 변경이 함께 검토되어야 하는지만 정의한다.

구현 목적은 검색 엔진을 새로 만드는 것이 아니라, 의미론 변경이 taxonomy, coordinate, transition, materialized index, feedback proposal에 어떤 영향을 주는지 결정론적으로 보고하는 control surface를 제공하는 것이다. 따라서 첫 구현은 runtime store가 아니라 manifest, snapshot, change classification, compatibility report를 만드는 순수 커널로 시작한다.

## Pack 단위 ^defines

`SemanticIndexingPack`은 자연어 의미와 좌표 시스템이 같은 release boundary 안에서 호환되는지 판단하기 위한 조립 단위다.

| Plane | 담당 질문 | 대표 책임 문서/패키지 |
|---|---|---|
| semantic source | 어떤 표현이 같은 의미인가 | `coord-semantic-indexing-logic`, definition-service semantic grounding |
| taxonomy plane | 어떤 닫힌 vocabulary와 분류 경계로 관리하는가 | `taxonomy-boundaries`, `definition-taxonomy`, `operational-ontology-taxonomy-schema`, `taxonomy-engine` |
| coordinate plane | 어떤 axis/prefix/version/address로 배정하는가 | `coord-foundation`, `schema-layer-spec`, `index-meta-system`, `weighted-index` |
| transition plane | 좌표 위 상태 변화가 어떤 DSL로 닫히는가 | `spec-transition`, `analysis-transition`, `spec-core` |
| materialization plane | 어떤 파생 인덱스로 투영하는가 | address index, text index, vector index, SQL metadata index |
| feedback plane | unresolved term을 어떤 변경 후보로 되돌리는가 | alias 추가, entry 추가, axis 승격, version 전환 proposal |

## 산출물 계약 ^contract

구현된 타입과 함수는 `packages/spec-core/src/semantic-indexing-pack/`가 SSOT다. 아래 표는 문서 관점의 역할 계약만 유지한다.

| 산출물 | 책임 | 소유 경계 |
|---|---|---|
| `SemanticIndexingPackManifest` | Pack을 구성하는 문서, 패키지, plane, materialized surface 목록을 선언한다 | Layout/Pack 조립. 실행 behavior 없음 |
| `SemanticIndexingPackSnapshot` | manifest와 source fingerprint, git freshness, dirty surface를 하나의 관찰 단위로 고정한다 | 재생성 가능해야 하며 영속 SSOT가 아니다 |
| `SemanticIndexingPackChange` | 변경된 surface를 semantic/taxonomy/coordinate/transition/materialization/feedback plane 중 하나로 분류한다 | 변경 분류만 소유하고 실제 수정은 각 plane이 수행 |
| `SemanticIndexingCompatibilityReport` | compatible, review-required, version-transition-required, invalid 중 하나로 pack 영향도를 판정한다 | human review 입력. 자동 적용 금지 |
| `SemanticIndexingPromotionProposal` | unresolved term을 alias-add, entry-add, axis-promotion, version-transition 후보로 정규화한다 | proposal이며 즉시 catalog를 수정하지 않음 |
| `SemanticIndexingGroundingPlan` | RAG, text-to-SQL, user-search가 Pack report에서 참조 가능한 plane/surface 후보를 제한한다 | 후보 제한과 위임 계획만 소유. 검색/SQL 생성 실행 없음 |
| `SemanticGroundingRuntimeSnapshot` | definition-service의 semantic term, alias, relation, open proposal을 런타임 관찰 단위로 고정한다 | SQLite store adapter가 기본. in-memory는 테스트 fixture 전용 |

## 구현 배치 ^implementation

- 1차 구현 위치는 `packages/spec-core/src/semantic-indexing-pack/`가 적합하다. `spec-core`는 이미 spec registry, propagation, transition, DKG bridge를 포함하므로 Pack의 순수 판정 커널을 둘 수 있다.
- `definition-service`는 semantic term, alias, relation, grounding event, feedback proposal의 런타임 저장/조회 책임을 유지한다.
- `taxonomy-engine`, `operational-ontology`, `definition-catalog`는 vocabulary와 taxonomy validation 책임을 유지한다.
- `index-meta`, `weighted-index`, `spec-schema`는 prefix, version, capacity, address encoding 책임을 유지한다.
- visualization은 독립 canonical package가 아니라 대상 repo/package 하위 viewer/proof surface로 연결한다.
- 새 패키지는 `spec-core`가 dependency cycle을 만들거나 CLI/runtime 양쪽에서 독립 배포가 필요해질 때만 만든다.

장기 실행 경로에서 Pack catalog 전체를 in-memory registry로 유지하지 않는다. 테스트 fixture는 in-memory를 사용할 수 있지만, 런타임에서 semantic term/alias/relation/proposal을 조회해야 하면 SQLite 기반 store port를 기본으로 둔다.

## 관련 소스 ^implementation

- `packages/spec-core/src/semantic-indexing-pack/types.ts` — manifest, snapshot, change, report, proposal 타입
- `packages/spec-core/src/semantic-indexing-pack/manifest.ts` — required plane과 duplicate ref 검증
- `packages/spec-core/src/semantic-indexing-pack/classify.ts` — manifest ref 우선 변경 plane 분류
- `packages/spec-core/src/semantic-indexing-pack/compatibility.ts` — compatible/review/version-transition/invalid 판정
- `packages/spec-core/src/semantic-indexing-pack/proposal.ts` — unresolved term proposal 정규화
- `packages/spec-core/src/semantic-indexing-pack/sort.ts` — dirty, freshness, role 기준 surface 정렬
- `packages/spec-core/src/semantic-indexing-pack/report.ts` — review-only report 객체와 Markdown 렌더링
- `packages/spec-core/src/semantic-indexing-pack/grounding.ts` — Pack report 기반 RAG/text-to-SQL/user-search 후보 plane 제한과 materialized index 위임 계획
- `packages/spec-core/src/semantic-indexing-pack/semantic-indexing-pack.test.ts` — 순수 커널, report, grounding planner 단위 테스트
- `packages/cli/src/commands/spec.ts:runSpecSemanticPackReport` — `qa-sdk spec semantic-pack report` 실행 표면
- `packages/cli/src/commands/spec-semantic-pack.test.ts` — report CLI JSON 출력 smoke
- `packages/definition-service/src/core/semantic-grounding/types.ts:SemanticGroundingRuntimeSnapshot` — semantic runtime snapshot 타입
- `packages/definition-service/src/stores/semantic-grounding-store.ts:SqlSemanticGroundingStore` — SQLite-backed semantic term/alias/relation/proposal snapshot adapter
- `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts:SemanticGroundingService` — runtime snapshot service facade

## 조립 순서 ^method

1. raw docs/schema/events/code에서 semantic 후보를 추출한다.
2. label, alias, entity, relation 후보를 canonical graph로 정렬한다.
3. taxonomy plane이 vocabulary 경계와 적용 대상을 먼저 고정한다.
4. 5Q checklist를 통과한 항목만 coordinate plane으로 승격한다.
5. coordinate plane이 prefix, version, capacity, address를 배정한다.
6. 상태 의미가 필요한 경우 transition plane이 좌표 패턴과 상태 변이를 연결한다.
7. materialization plane이 같은 semantic snapshot을 address/text/vector/SQL metadata index로 투영한다.
8. grounding 실패와 unresolved term은 feedback plane으로 돌아가 alias/entry/axis/version 변경 후보가 된다.

## 호환성 규칙 ^constraint

1. taxonomy 변경은 pack minor 변경이다. 기존 axis entry 의미를 바꾸면 version 전환 후보가 된다.
2. axis 추가는 5Q를 통과해야 하며, pack compatibility report에 근거를 남긴다.
3. prefix shape 또는 capacity 변경은 coordinate plane의 version 전환으로 닫는다.
4. TransitionSpec은 raw coordinate system 위의 해석 계층이다. transition 추가가 axis 의미 변경을 암묵적으로 대체하면 안 된다.
5. materialized index는 pack snapshot의 파생물이다. text/vector/SQL index가 독자적으로 canonical 의미를 소유하지 않는다.
6. feedback은 즉시 pack을 수정하지 않는다. proposal로 남기고 taxonomy/coordinate/transition plane 중 어느 변경인지 분류한다.
7. `SemanticIndexingCompatibilityReport`가 `version-transition-required` 또는 `invalid`를 반환하면 자동 적용하지 않고 coordinate-design 또는 관련 상위 review flow로 넘긴다.
8. `SemanticIndexingGroundingPlan`은 materialized index 재생성을 직접 수행하지 않고, materialization plane surface별 owner package 위임 항목만 만든다.

## 최신화 정렬 ^method

운영 보고서에서 같은 역할의 패키지를 정렬할 때는 최신 변경 표면을 먼저 둔다. 다만 이 문서의 안정된 조립 순서는 역할 경계 기준을 따른다.

| 역할 | 정렬 기준 |
|---|---|
| 현재 작업 중인 구현 | dirty package를 최상단에 둔다 |
| 같은 역할의 후보 | `git log -1 -- packages/<pkg>` 최신순 |
| 같은 날짜의 후보 | public library → browser/edge surface → runtime service → UI/demo 순 |
| 시각화 surface | 독립 canonical이 아니라 대상 repo/package의 하위 viewer/proof로 둔다 |

## 경계 ^constraint

- Pack은 조립 단위다. taxonomy validation, transition execution, coordinate encoding을 재구현하지 않는다.
- Pack은 behavior/data source를 직접 소유하지 않는다. `refs` 대상 문서와 패키지가 각자의 SSOT다.
- RAG/text-to-SQL/user search는 Pack을 통해 후보 공간을 제한하지만, Pack이 검색 엔진이나 SQL 생성기를 대체하지 않는다.
- third-party taxonomy나 ontology pack을 가져오더라도 coordinate plane으로 승격하기 전에는 pack namespace, collision, scoped prefix 기준을 검토한다.
- Pack report는 실행 결과가 아니라 의사결정 입력이다. alias 추가, entry 추가, axis 승격, version 전환은 별도 proposal 승인 후 각 plane에서 수행한다.

## 채택 기준 ^validation

| 질문 | 통과 기준 |
|---|---|
| taxonomy와 coordinate가 같이 움직이는가 | vocabulary 변경이 axis/prefix/version 영향으로 추적된다 |
| transition이 좌표와 분리되어 있는가 | TransitionSpec은 좌표 패턴을 참조하고, axis 의미를 재정의하지 않는다 |
| materialized index가 파생물인가 | address/text/vector/SQL metadata index가 같은 snapshot에서 재생성 가능하다 |
| feedback이 운영 가능한가 | unresolved term이 alias/entry/axis/version proposal 중 하나로 분류된다 |
| 시각화가 올바른 위치에 있는가 | viewer/proof surface는 대상 package 하위 설명으로 연결된다 |
| 구현 표면이 단순한가 | 1차 구현이 순수 manifest/report 커널로 닫히고 검색/저장/encoding을 재구현하지 않는다 |
