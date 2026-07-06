---
def:
  id: taxonomy-engine-taxonomy-concept
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
role: concept-taxonomy
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/schema/zod.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/__tests__/unit/parser.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/data-structure-profile.yaml
---

# Taxonomy — 한 좌표 공간

> [[axis]] + [[relation]] + [[constraint]]의 묶음. yaml 파일 단위.

## 목적 ^purpose

- 하나의 유한 vocabulary 좌표 공간을 self-contained yaml로 표현한다.
- parser가 yaml을 `TaxonomyIR`로 정규화해 validate/query/codegen/doctor의 공통 입력으로 사용한다.
- registry를 통해 다른 taxonomy에 대한 import 관계를 검증한다.

## 정의

좌표 공간 한 개의 완결된 단위. repo convention상 한 yaml 파일이 하나의 taxonomy를 선언한다.

```typescript
type TaxonomyIR = {
  taxonomy: string
  version: number
  description?: string
  contentHash: string
  axes: Map<string, AxisIR>
  relations: Map<string, RelationIR>
  constraints: ConstraintIR[]
  imports: ImportIR[]
}
```

## YAML 필드

| 필드 | 내용 |
|------|------|
| `taxonomy` | slug 식별자 |
| `version` | positive integer. top-level ref version 비교 기준 |
| `description` | 자유 텍스트 |
| `imports` | 다른 taxonomy slug/version/alias 선언 |
| `axes` | Axis 묶음. 최소 1개 필요 |
| `relations` | Relation 묶음. 없으면 빈 map |
| `constraints` | Constraint 목록. 없으면 빈 배열 |

## 정규화

- `axes`와 `relations`는 `Map`으로 정규화된다.
- string entry는 `{ id, address }`로 확장되며 address 기본값은 배열 index다.
- axis `capacity` 기본값은 `nextPowerOf2(entries.length * 2)`다.
- axis `version` 기본값은 `1`이다.
- parser는 entry/axis `_loc`를 보존해 진단 위치와 IDE jump-to-definition의 기반을 제공한다.
- `contentHash`는 taxonomy/version/axes/relations/constraints를 stable stringify한 sha256 앞 16자다.

## repo-owned taxonomies

현재 `docs/taxonomies/`에는 다음 yaml이 있다.

| taxonomy | 역할 |
|----------|------|
| `qa-sdk-coordinate-system` | qa-sdk definition 좌표계 도그푸딩 |
| `lesson-builder-content` | 외부 콘텐츠 모델과 cross-tax import 사례 |
| `dkg-schema` | DKG node/edge vocabulary |
| `ingest-coords` | ingest store/driver matrix |
| `qa-sdk-def-catalog` | definition-catalog vocabulary |
| `data-structure-profile` | data-structure-profile vocabulary |

taxonomy-engine dogfooding 테스트는 `qa-sdk-coordinate-system`, `lesson-builder-content`, `dkg-schema`, `ingest-coords`, `qa-sdk-def-catalog`의 parse/validate/codegen/doctor 또는 registry behavior를 직접 확인한다.

## import의 의미

`imports`는 parser 단계에서 IR에 보존된다. 실제 해소는 registry가 주어진 validate 단계에서 수행된다.

- target taxonomy가 registry에 없으면 `ref-unresolved-import`
- target version이 다르면 `ref-version-missing`
- registry가 없으면 backward compatibility를 위해 import 검증을 skip한다

## 다른 개념과의 관계

- [[axis]], [[relation]], [[constraint]]: Taxonomy의 구성 요소
- [[registry]]: 여러 Taxonomy IR을 함께 보관하는 우주
- [reference-grammar.md](../reference-grammar.md): taxonomy slug와 version을 포함하는 ref grammar

## 참조

- 타입: `packages/taxonomy-engine/src/schema/ir.ts`
- schema: `packages/taxonomy-engine/src/schema/zod.ts`
- parser: `packages/taxonomy-engine/src/parser/index.ts`
- 도그푸딩: `docs/taxonomies/*.yaml`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/parser.test.ts __tests__/unit/validate.test.ts __tests__/dogfooding.test.ts __tests__/dogfooding-lesson-builder.test.ts __tests__/dogfooding-dkg.test.ts __tests__/dogfooding-ingest.test.ts __tests__/dogfooding-def-catalog.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
