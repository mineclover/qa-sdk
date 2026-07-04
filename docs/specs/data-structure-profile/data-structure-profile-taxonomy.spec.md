---
def:
  id: data-structure-profile-taxonomy
  type: spec
  tier: component
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: data-structure-profile
  tags: [taxonomy, vocabulary, data-structure, structural]
  links:
    - target: data-structure-profile-system
      type: refines
  sources:
    - docs/taxonomies/data-structure-profile.yaml
    - packages/data-structure-profile/src/taxonomy.ts
---

# Data Structure Profile Taxonomy

## 목적 ^purpose

Data Structure Profile taxonomy는 여러 profile에서 반복 사용되는 finite data-structure vocabulary와 stable relation grammar를 고정한다. 이 문서는 concrete Kafka topic, JSONPath, fact table, measurement value, DPM policy ref를 소유하지 않는다.

## Vocabulary Authority ^defines

Approved baseline의 taxonomy SSOT는 `docs/taxonomies/data-structure-profile.yaml`이다. 현재 축은 다음 책임으로 닫힌다.

| Axis | 책임 |
|---|---|
| `data-source-kind` | source 또는 target system kind |
| `structure-kind` | lineage graph의 reusable structural node kind |
| `transform-kind` | profile transform instance가 참조하는 reusable transform kind |
| `measurement-kind` | dry-run report가 산출하는 reusable measurement dimension |
| `quality-risk` | validator와 quality gate가 보고하는 reusable risk vocabulary |
| `adapter-capability` | profile decision에서 참조하는 stable adapter capability |

## Relation Grammar ^defines

Taxonomy relation은 reusable semantic grammar만 표현한다. 현재 accepted relation kind는 `contains`, `depends-on`, `binds`, `projects-to`로 제한된다.

| Relation | 의미 |
|---|---|
| `source-can-hold-structure` | source kind가 담을 수 있는 structure kind |
| `structure-can-contain` | structure kind 간 containment 가능성 |
| `transform-applies-to` | transform kind가 적용 가능한 structure kind |
| `transform-produces-measurement` | transform kind가 발생시키는 measurement kind |
| `risk-observed-by` | quality risk를 관찰할 수 있는 measurement kind |
| `source-provides-capability` | source kind가 제공할 수 있는 adapter capability |
| `capability-enables-transform` | adapter capability가 가능하게 하는 transform kind |

## Boundary Rules ^constraint

- taxonomy-level entry는 유한하고 stable하며 여러 profile에서 재사용 가능해야 한다.
- profile-local identifier, concrete path, concrete target ref, measurement number는 taxonomy entry가 아니다.
- `taxonomy-engine` parse 결과는 profile validator가 axis entry existence를 확인하는 lookup input으로만 사용한다.
- vocabulary 확장은 qa-sdk 축 정의 규칙의 5Q checklist와 capacity 여유를 통과해야 한다.

## 관련 소스

- `docs/taxonomies/data-structure-profile.yaml` — vocabulary and relation SSOT
- `packages/data-structure-profile/src/taxonomy.ts` — taxonomy-engine parse result를 profile lookup vocabulary로 변환
