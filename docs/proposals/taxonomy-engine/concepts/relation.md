---
def:
  id: taxonomy-engine-relation-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: data
  aspect: concept
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-relation
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/validate/ref.ts
  - packages/taxonomy-engine/src/validate/constraint.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/__tests__/unit/query.test.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/ref.test.ts
---

# Relation — 화살표

> [[coordinate]] 사이의 의미적 연결. 텍소노미 공간 안의 1급 시민.

## 정의

좌표/[[entry]] 간 의미적 연결을 선언적으로 표현하는 화살표. 별도 차원이 아니라 차원 위의 메타데이터로 박힌다.

## 목적 ^purpose

- 좌표 공간이 단순 점 집합이 아니라 **구조**를 갖도록
- 계층/의존/구동 같은 cross-axis 관계를 직교성 깨지 않고 표현
- "데이터가 상위 구조에서 하위 구조로 흘러간다"는 사용자 요구를 1급으로 모델링

## 구조 (개념)

| 속성 | 의미 |
|------|------|
| `name` | 관계의 이름 (예: `layer-contains`) |
| `from` | 화살표 출발 axis 집합 |
| `to` | 화살표 도착 axis 집합 |
| `kind` | 관계 종류 (의미론) |
| `rules` | 구체 매핑 — 출발 entry → 도착 entry 짝 목록 |

## kind — 관계 종류

| kind | 의미 | 예시 |
|------|------|------|
| `contains` | 소속 (상위가 하위를 가진다) | scenario → stage → cue |
| `parent-of` | 위계 (분류 트리의 부모) | aspect protocol의 부모는 model |
| `depends-on` | 의존 (있어야 작동) | runtime은 protocol에 의존 |
| `binds` | 구동 (한쪽이 다른 쪽 파라미터를 움직임) | clip이 asset.control을 binds |
| `projects-to` | 투영 (cross-taxonomy 매핑) | lesson-builder layer → qa-sdk layer |

각 kind는 의미만 다르고 구조는 동일 (from/to/rules). 검증/순회 시 kind별로 다른 정책 가능.

## 핵심 원리

### 직교성 보존

계층(Layer 0~5)이나 cross-cutting binding(Clip ↔ Asset)을 새 axis로 만들지 않는다. 모두 Relation으로 표현. 그래서 axis는 항상 직교, 관계만 풍부해진다.

### Rule의 field 이름이 axis name

rules의 각 객체에서 키는 [[axis]] name이고 값은 [[entry]] id:
```yaml
rules:
  - { scope: apm, aspect: model }
```

검증기는 field 이름을 axis로 자동 매칭. 모든 relation kind에 일관 적용. 단 backward compat을 위해 `upper/parent/lower/child` 키워드는 `from[0]/to[0]`로 폴백.

### Cross-taxonomy 화살표

`projects-to` kind는 다른 [[taxonomy]]의 entry를 가리킬 수 있다. import alias 사용:
```yaml
relations:
  layer-mapping:
    from: layer
    to: layer
    kind: projects-to
    rules:
      - { layer: domain, qac.layer: domain }    # qac은 import alias
```

이게 [[registry]] 안에서 텍소노미들을 연결하는 메커니즘.

### 순환의 의미

같은 kind에서 `a → b → a` 같은 순환은 의미적 위반 (qa-sdk LinkType 정책 답습). 단, kind가 다르면 (예: `depends-on`은 양방향) 허용. 순환 검출은 검증 단계 책임.

### Constraint와의 분리

Relation은 **선언** — "이런 화살표가 있다". Constraint는 **제약** — "이런 화살표 조합은 금지". 두 개념 분리로 의미와 무결성을 따로 관리.

## 다른 개념과의 관계

- [[coordinate]] — 화살표의 양 끝
- [[axis]] — 화살표가 가로지르는 차원
- [[entry]] — 화살표 rules의 구체 매핑값
- [[taxonomy]] — Relation의 소속 공간
- [[registry]] — cross-taxonomy 화살표가 사는 우주

## 사용 예시

### 단순 계층 (qa-sdk)

```yaml
depth-contains:
  from: depth
  to: depth
  kind: contains
  rules:
    - { upper: overview, lower: system }
    - { upper: system,   lower: layer }
```

### Cross-axis binding (lesson-builder)

```yaml
clip-binds-asset-control:
  from: clip-template
  to: param-kind
  kind: binds
  rules:
    - { clip-template: appear-fade, param-kind: control }
```

이 한 줄이 "Clip은 Asset의 control 영역만 구동한다"는 lesson-builder TAXONOMY의 핵심 원리를 표현. 새 axis 추가 없이.

### 그래프 순회

`walkRelation(ir, 'layer-contains', 'scenario')`는 scenario에서 출발해 contains 화살표를 DFS로 따라가 도달 가능한 모든 entry 반환. 순환 방지 내장.

## 참조

- spec: `docs/proposals/taxonomy-engine/00-design.md` §4.1, §4.2
- LinkType 정책 (qa-sdk): `docs/specs/definition-catalog/` 의 contains/depends_on/implements/refines/constrains/traces_to
- 관계의 일반화 결정 (T-A3): 코드 `packages/taxonomy-engine/src/validate/ref.ts`의 `inferAxis`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/query.test.ts __tests__/unit/validate.test.ts __tests__/unit/ref.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
