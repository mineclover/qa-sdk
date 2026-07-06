---
def:
  tier: component
  id: work-domain-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: cli
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: work-domain-quality-bundle
      type: refines
sources:
  - packages/work-domain/src/index.ts
  - packages/work-domain/src/types.ts
  - packages/work-domain/src/quality-gates.ts
  - packages/work-domain/src/mapping.ts
  - packages/work-domain/src/classify.ts
  - packages/work-domain/src/work-domain.test.ts
---
# Work Domain Public Contract


## 탐색 ^navigation

quality-gates-system > work-domain-quality-bundle > **work-domain-quality-contract**

형제: `gate-work-domain-typecheck` · `gate-work-domain-build` · `gate-work-domain-test`

## 목적 ^purpose

`work-domain` 패키지가 외부 소비자에게 약속하는 공개 타입과 함수 surface를 한 문서로 고정하여, 개별 품질 게이트가 무엇을 검증하는지 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `WorkDomainId`, `GateKindId`, `QualityGate`, `QualityGateSpec`, `resolveQualityGates()`, `buildDocQuery()`, `classifyUserStory()`다.
validation gate 문서는 이 계약을 깨지 않았는지 각 범위에서 검증한다.

## 입력 ^inputs

- 외부 소비자는 `WorkDomainId`와 `GateKindId`를 안정 식별자로 사용한다.
- 품질 게이트 선택 입력은 `WorkDomainId`와 사용자 스토리 텍스트다.
- 문서 질의 입력은 scope/aspect/layer/tag 같은 정의 메타데이터다.

## 출력 ^outputs

- `resolveQualityGates()`는 도메인별 기본 품질 게이트 목록을 반환한다.
- `buildDocQuery()`는 definition-catalog 조회에 바로 쓸 수 있는 질의 객체를 반환한다.
- `classifyUserStory()`는 추론된 work domain과 confidence/signals를 반환한다.

## 사전 조건 ^precondition

- `work-domain` registry에 도메인/서브도메인/게이트 taxonomy가 등록돼 있어야 한다.
- 공개 타입 이름과 함수 시그니처는 breaking change 없이 유지되어야 한다.
- quality bundle은 이 계약 문서를 기준으로 typecheck/build/test 게이트를 실행한다.

## 사후 조건 ^postcondition

- typecheck gate는 공개 타입 surface가 깨지지 않았음을 보장한다.
- build gate는 package export와 산출물 구성이 유지됨을 보장한다.
- test gate는 registry/mapping/classification 로직이 기대 동작을 유지함을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims work-domain-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-work-domain-typecheck`, `gate-work-domain-build`, `gate-work-domain-test`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 파일이 저장소에 존재해야 한다. [reversible]

## 관련 소스

- `work-domain/src/types.ts`
- `work-domain/src/quality-gates.ts`
- `work-domain/src/mapping.ts`
- `work-domain/src/classify.ts`
