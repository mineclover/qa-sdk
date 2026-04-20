---
def:
  id: df-narrative-proofs
  type: spec
  tier: system
  address: def_document:v2:70020
  scope: feature
  aspect: scenario
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision, testing]
  links:
    - target: df-narrative-context
      type: contains
    - target: df-narrative-structure
      type: contains
    - target: df-narrative-proof-coordinate-space
      type: contains
    - target: df-narrative-proof-core-gates
      type: contains
    - target: df-narrative-proof-story-assembly
      type: contains
    - target: df-narrative-proof-operational-cases
      type: contains
    - target: df-system
      type: depends_on
---
# Decision Flow — 서사 증명

## 목적 ^purpose

decision-flow의 핵심 주장들을 질문→증명→결론 형태로 묶어 읽는 모듈. 좌표 압축, 코어 gate, 서사 조립, 실제 운영 사례를 proof cluster 단위로 나눠 관리한다.

## 구성 ^overview

- `df-narrative-proof-coordinate-space`: 장 1~3. 축 압축, 반복 패턴, 벡터 차이 분석을 다룬다.
- `df-narrative-proof-core-gates`: 장 4~6. 코어 gate, 직교성 검증, 축 선택 근거를 다룬다.
- `df-narrative-proof-story-assembly`: 장 7~9. 서사 구조, ContextProvider, 시스템 관통 맥락 조립을 다룬다.
- `df-narrative-proof-operational-cases`: 장 10~11. 실제 판단 사례와 세션 영속을 다룬다.

## 관련 소스

증명 코드: `packages/decision-flow/src/proof.test.ts` (125 tests)

## 읽는 순서

1. `df-narrative-proof-coordinate-space`
2. `df-narrative-proof-core-gates`
3. `df-narrative-proof-story-assembly`
4. `df-narrative-proof-operational-cases`

## 주의사항 ^caveat

- 이전 단일 리프 문서의 11개 장은 아래 4개 멤버 문서로 재배치되었다.
- 서사 구조와 ContextProvider의 기준 정의는 `df-narrative-structure`, `df-narrative-context`를 우선 참조한다.
