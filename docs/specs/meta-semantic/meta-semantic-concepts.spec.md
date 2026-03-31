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
    - target: ms-concept-five-roles
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
---

# 핵심 개념

## 목적 ^purpose

데이터와 로직 추적의 기초 표준이 되는 7가지 원자 개념을 정의한다.
각 개념은 의존 순서로 쌓이며, 하위 개념 없이 상위 개념이 성립하지 않는다.

**이 표준의 범위:** 데이터의 흐름과 로직의 구조를 동시에 추적한다.
5원 분리는 데이터의 역할을, 바운더리 이상은 로직의 구조를 다루며,
Spacetime UID에서 데이터와 로직이 하나의 주소 체계로 합류한다.

## 위임 ^delegates

각 개념의 상세 정의는 하위 문서에 위임한다:

- **ms-concept-five-roles** → 5원 분리: 생산·소비·정의·관리·저장 역할 분리 규칙
- **ms-concept-boundary** → 바운더리: 5원 중 일부가 존재하는 검증 가능 기능 단위
- **ms-concept-contract-descent** → 계약 하향: 상호 무지, 자기 계약 명확 원칙
- **ms-concept-folding** → Semantic Folding: 코드에서 바운더리를 찾는 메커니즘
- **ms-concept-verification-unit** → 검증 단위: Folding이 산출하는 독립 테스트 가능 함수
- **ms-concept-branch-path** → 분기 경로: 전곱이 아닌 도달 가능 경로의 합
- **ms-concept-spacetime-uid** → Spacetime UID: 경로 + 시간 = 시공간 식별자

## 구성 ^overview

7개 개념의 의존 순서:

1. **5원 분리** — 데이터의 5가지 역할을 분리하는 설계 규칙 (토대)
2. **바운더리** — 5원 중 일부가 존재하는 검증 가능한 기능 단위. 모듈을 정의하는 것
3. **계약 하향** — 바운더리 간 상호 무지, 자기 계약 명확
4. **Semantic Folding** — 코드에서 바운더리를 찾는 메커니즘
5. **검증 단위** — Folding이 산출하는 것: 독립 테스트 가능한 함수
6. **분기 경로** — 검증 단위 내의 경우의 수를 세는 방법
7. **Spacetime UID** — 분기 경로에 시간을 결합한 주소

---

## 개념 의존 그래프

```
① 5원 분리
   └── ② 바운더리 ("5원 중 일부가 존재하는 검증 가능 기능 단위가 모듈이다")
        └── ③ 계약 하향 ("상호 무지, 자기 계약 명확")
             └── ④ Semantic Folding ("코드에서 바운더리를 찾는 방법")
                  └── ⑤ 검증 단위 ("Folding이 산출하는 것")
                       └── ⑥ 분기 경로 ("검증 단위 내 경우의 수")
                            └── ⑦ Spacetime UID ("경로 + 시간 = 주소")
```

5원 분리가 없으면 바운더리를 정의할 수 없고,
바운더리가 없으면 Folding할 대상이 없고,
Folding이 없으면 검증 단위를 식별할 수 없고,
검증 단위가 없으면 분기 경로를 셀 수 없고,
분기 경로가 없으면 UID를 부여할 수 없다.

---

## qa-sdk 기존 개념과의 대응

| meta-semantic 개념 | qa-sdk 기존 개념 | 관계 |
|---|---|---|
| 5원 분리 | — | 신규. qa-sdk에는 없던 데이터 역할 분리 규칙 |
| 바운더리 | DefLevel (group/module/leaf) | 바운더리가 DefLevel을 결정 |
| 계약 하향 | contains 링크 + concern 전파 | 방향이 같음 (상위→하위) |
| Semantic Folding | assembleFeature() 접기/펼치기 | 문서 조립의 코드 확장 |
| 검증 단위 | DefinitionEntry (leaf) | 좌표 부여 대상의 최소 단위 |
| 분기 경로 | PrefixDef.dims (축 조합) | 전곱→경로 모델로 확장 |
| Spacetime UID | SemanticAddress (schema:version:index) | 동일 직렬화 체계, 다른 차원 구성 |
