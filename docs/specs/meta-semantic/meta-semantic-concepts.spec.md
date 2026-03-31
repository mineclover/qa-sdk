---
def:
  id: meta-semantic-concepts
  type: knowledge
  knowledge_kind: concept
  level: module
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [entry-point]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: system-concepts
      type: refines
    - target: ms-concept-data-facets
      type: contains
    - target: ms-concept-boundary
      type: contains
    - target: ms-concept-contract-descent
      type: contains
    - target: ms-concept-folding
      type: contains
    - target: ms-concept-verification-unit
      type: contains
    - target: ms-concept-branch-path
      type: contains
    - target: ms-concept-spacetime-uid
      type: contains
    - target: ms-concept-pipe
      type: contains
---

# 핵심 개념

## 목적 ^purpose

데이터와 로직 추적의 기초 표준이 되는 8가지 원자 개념을 정의한다.
개념은 두 축으로 구성된다: **구조 축**(무엇이 존재하는가)과 **실행 축**(무엇이 함께 실행되는가).

**이 표준의 범위:** 데이터의 흐름과 로직의 구조를 동시에 추적한다.
데이터 패싯는 데이터의 역할을, 바운더리는 개념 단위를, 파이프는 실행 단위를 정의하며,
Spacetime UID에서 데이터와 로직이 하나의 주소 체계로 합류한다.

## 위임 ^delegates

각 개념의 상세 정의는 하위 문서에 위임한다:

- **ms-concept-data-facets** → 데이터 패싯: 생산·소비·정의·관리·저장 역할 분리 규칙
- **ms-concept-boundary** → 바운더리: 패싯 중 일부가 존재하는 검증 가능 기능 단위 (개념 단위)
- **ms-concept-pipe** → 파이프: 개념 단위들의 확정적 실행 묶음 (실행 단위)
- **ms-concept-contract-descent** → 계약 하향: 상호 무지, 자기 계약 명확 원칙
- **ms-concept-folding** → Semantic Folding: 코드에서 바운더리를 찾는 메커니즘
- **ms-concept-verification-unit** → 검증 단위: Folding이 산출하는 독립 테스트 가능 함수
- **ms-concept-branch-path** → 분기 경로: 전곱이 아닌 도달 가능 경로의 합
- **ms-concept-spacetime-uid** → Spacetime UID: 경로 + 시간 = 시공간 식별자

## 구성 ^overview

8개 개념, 두 축:

**구조 축** (무엇이 존재하는가):

1. **데이터 패싯** — 데이터의 5가지 역할을 분리하는 설계 규칙 (토대)
2. **바운더리** — 패싯 중 일부가 존재하는 검증 가능한 기능 단위 (개념 단위)
3. **계약 하향** — 바운더리 간 상호 무지, 자기 계약 명확

**실행 축** (무엇이 함께 실행되는가):

4. **파이프** — 개념 단위들의 확정적 실행 묶음 (실행 단위)
5. **Semantic Folding** — 코드에서 바운더리와 파이프를 찾는 메커니즘
6. **검증 단위** — Folding이 산출하는 것: 독립 테스트 가능한 파이프
7. **분기 경로** — 검증 단위 내의 경우의 수를 세는 방법
8. **Spacetime UID** — 분기 경로에 시간을 결합한 주소

---

## 개념 의존 그래프

```
구조 축:
  ① 데이터 패싯
     └── ② 바운더리 (개념 단위)
          └── ③ 계약 하향

실행 축:
  ② 바운더리 ──→ ④ 파이프 (개념 단위들의 실행 묶음)
                    │
  ③ 계약 하향 ──→  │
                    ↓
                 ⑤ Semantic Folding (바운더리 + 파이프를 코드에서 찾기)
                    └── ⑥ 검증 단위 (테스트 가능한 파이프)
                         └── ⑦ 분기 경로 (파이프 내 경우의 수)
                              └── ⑧ Spacetime UID (경로 + 시간)
```

**구조 축과 실행 축의 관계:**
- 바운더리(②)가 개념 단위를 정의하면, 파이프(④)가 그 단위들을 실행으로 묶는다
- 개별 패싯은 leaf에서 정의하되, 실행할 때는 파이프로 묶는다
- 검증 단위(⑥) ≈ 독립 테스트 가능한 파이프

---

## qa-sdk 기존 개념과의 대응

| meta-semantic 개념 | qa-sdk 기존 개념 | 관계 |
|---|---|---|
| 데이터 패싯 | — | 신규. qa-sdk에는 없던 데이터 역할 분리 규칙 |
| 바운더리 | DefLevel (group/module/leaf) | 바운더리가 DefLevel을 결정 |
| 파이프 | PipeIR (트랜잭션 트리거) | 트리거→실행 묶음으로 격상 |
| 계약 하향 | contains 링크 + concern 전파 | 방향이 같음 (상위→하위) |
| Semantic Folding | assembleFeature() 접기/펼치기 | 문서 조립의 코드 확장 |
| 검증 단위 | DefinitionEntry (leaf) | 좌표 부여 대상의 최소 단위 |
| 분기 경로 | PrefixDef.dims (축 조합) | 전곱→경로 모델로 확장 |
| Spacetime UID | SemanticAddress (schema:version:index) | 동일 직렬화 체계, 다른 차원 구성 |
